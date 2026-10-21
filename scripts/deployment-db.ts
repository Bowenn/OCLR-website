/** Database/HTTP checks used only by the Bash updater; never imported by the app. */
import { createHash } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
  renameSync,
  statSync,
  createReadStream,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import http from "node:http";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Export ${name} before updating.`);
  return value;
}
export function databaseUrl(value: string) {
  const url = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !!url.hash ||
    !url.pathname.slice(1) ||
    !["verify-full", "disable"].includes(
      url.searchParams.get("sslmode") || "",
    ) ||
    [...url.searchParams.keys()].some(
      (key) =>
        !["sslmode", "sslrootcert", "sslcert", "sslkey"].includes(key) ||
        url.searchParams.getAll(key).length !== 1,
    )
  )
    throw new Error(
      "Use an explicit PostgreSQL database URL with sslmode=verify-full or sslmode=disable for the chosen network.",
    );
  return url;
}
function targets() {
  if (Object.keys(process.env).some((key) => key.startsWith("PG")))
    throw new Error(
      "Unset inherited PG* options; use the explicit database URLs for deployment.",
    );
  if (!["production", "staging"].includes(required("OCLR_ENVIRONMENT")))
    throw new Error("Choose an explicit production or staging environment.");
  const runtime = databaseUrl(required("DATABASE_URL"));
  const migration = databaseUrl(required("MIGRATION_DATABASE_URL"));
  const identity = (url: URL) =>
    `${url.hostname}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
  if (
    identity(runtime) !== identity(migration) ||
    runtime.hostname !== required("OCLR_EXPECTED_DB_HOST") ||
    decodeURIComponent(runtime.pathname.slice(1)) !==
      required("OCLR_EXPECTED_DB_NAME")
  )
    throw new Error(
      "Runtime/migration database target does not match the explicitly expected host and database.",
    );
  return { runtime, migration, identity: identity(runtime) };
}
function files() {
  const folder = resolve("drizzle");
  const journal = JSON.parse(
    readFileSync(join(folder, "meta/_journal.json"), "utf8"),
  ) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  if (
    !journal.entries.length ||
    journal.entries.some(
      (entry, i, entries) =>
        entry.idx !== i ||
        !/^\d{4}_[a-z0-9_]+$/.test(entry.tag) ||
        !Number.isSafeInteger(entry.when) ||
        (i > 0 && entry.when <= entries[i - 1].when),
    )
  )
    throw new Error("Migration journal ordering is invalid.");
  const sqlFiles = readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (
    JSON.stringify(sqlFiles) !==
    JSON.stringify(journal.entries.map((entry) => `${entry.tag}.sql`).sort())
  )
    throw new Error("Migration SQL files and committed journal disagree.");
  return {
    journal,
    migrations: readMigrationFiles({ migrationsFolder: folder }),
    folder,
  };
}
async function pending(client: Client) {
  const data = files();
  const table = await client.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') AS name",
  );
  const applied = table.rows[0].name
    ? (
        await client.query(
          "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
        )
      ).rows
    : [];
  if (
    applied.length > data.migrations.length ||
    applied.some(
      (entry, i) =>
        entry.hash !== data.migrations[i].hash ||
        Number(entry.created_at) !== data.migrations[i].folderMillis,
    )
  )
    throw new Error(
      "Applied migration history differs from this release. Stop and investigate drift; never reset the journal.",
    );
  return {
    ...data,
    tags: data.journal.entries.slice(applied.length).map((entry) => entry.tag),
  };
}
async function backup(url: URL, directory: string) {
  const partial = join(directory, "database.dump.partial");
  const final = join(directory, "database.dump");
  if (existsSync(partial) || existsSync(final))
    throw new Error("Backup target already exists; refusing to overwrite it.");
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("PG") || key === "MIGRATION_DATABASE_URL")
      delete env[key];
  Object.assign(env, {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get("sslmode")!,
    PGCONNECT_TIMEOUT: "10",
  });
  const supported = {
    sslmode: "PGSSLMODE",
    sslrootcert: "PGSSLROOTCERT",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
  };
  for (const [key, value] of url.searchParams) {
    if (!(key in supported) || url.searchParams.getAll(key).length !== 1)
      throw new Error(
        "Backup URL contains unsupported/repeated connection options; review the database configuration.",
      );
    env[supported[key as keyof typeof supported]] = value;
  }
  const command = (name: string, args: string[]) => {
    const result = spawnSync(name, args, {
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `${name} failed; no migrations were applied. Inspect database access and client/server versions privately.`,
      );
    return result.stdout;
  };
  command("pg_dump", ["--format=custom", "--file", partial]);
  if (
    !statSync(partial).size ||
    !command("pg_restore", ["--list", partial]).trim()
  )
    throw new Error("Database backup is empty or unreadable.");
  // Decode all archive data, not just its table of contents. This never restores a DB.
  command("pg_restore", ["--file=/dev/null", partial]);
  renameSync(partial, final);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(final)) hash.update(chunk);
  writeFileSync(`${final}.sha256`, `${hash.digest("hex")}  database.dump\n`, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(`Verified database archive: ${final}`);
}
// Fetch can discard Host overrides. Use HTTP directly for the private listener,
// otherwise canonical-host redirects make a healthy application fail activation.
function localResponse(url: URL, host: string) {
  return new Promise<Response>((resolve, reject) => {
    const request = http.get(
      url,
      { headers: { Host: host }, signal: AbortSignal.timeout(5000) },
      (response) => {
        const options = {
          status: response.statusCode || 502,
          headers: { "content-type": response.headers["content-type"] || "" },
        };
        if (url.pathname !== "/api/health") {
          resolve(new Response(null, options));
          response.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 16384) {
            reject(new Error("Oversized health response."));
            response.destroy();
          } else chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve(new Response(size ? Buffer.concat(chunks) : null, options)),
        );
      },
    );
    request.on("error", reject);
  });
}

function networkFailure(error: unknown): string {
  const code =
    error && typeof error === "object"
      ? "cause" in error &&
        error.cause &&
        typeof error.cause === "object" &&
        "code" in error.cause
        ? error.cause.code
        : "code" in error
          ? error.code
          : undefined
      : undefined;
  // Never echo provider messages, response bodies, credentials or redirect URLs.
  if (
    typeof code === "string" &&
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ENOTFOUND",
      "EAI_AGAIN",
      "ETIMEDOUT",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(code)
  )
    return `connection failed (${code})`;
  if (
    error instanceof Error &&
    ["AbortError", "TimeoutError"].includes(error.name)
  )
    return "request timed out";
  return "request failed (check listener, DNS, TLS and proxy connectivity)";
}

async function health(sha: string) {
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Expected a release SHA for health verification.");
  const canonical = new URL(required("APP_URL"));
  if (
    canonical.protocol !== "https:" ||
    canonical.username ||
    canonical.password ||
    canonical.pathname !== "/" ||
    canonical.search ||
    canonical.hash
  )
    throw new Error("APP_URL must be the canonical HTTPS origin.");
  const host = process.env.OCLR_BIND_HOST || "127.0.0.1";
  const address =
    host === "0.0.0.0" ? "127.0.0.1" : host === "::" ? "::1" : host;
  const local = new URL(
    `http://${address.includes(":") ? `[${address}]` : address}:${process.env.PORT || "3000"}`,
  );
  const request = (url: URL, privateListener: boolean) =>
    privateListener
      ? localResponse(url, canonical.host)
      : fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
  const check = async (origin: URL, privateListener: boolean) => {
    let path = "/api/health";
    try {
      const response = await request(
        new URL(`${path}?release=${sha}`, origin),
        privateListener,
      );
      if (!response.ok) {
        await response.body?.cancel();
        return `${path}: HTTP ${response.status}${response.status >= 300 && response.status < 400 ? " (unexpected redirect; check canonical hostname/proxy)" : ""}`;
      }
      let body;
      try {
        body = await response.json();
      } catch {
        return `${path}: invalid JSON (check proxy routing)`;
      }
      if (body?.status !== "ok")
        return `${path}: application/database not ready`;
      if (body.release !== sha)
        return `${path}: release SHA mismatch (check service working directory, release marker and proxy upstream/cache)`;
      path = "/";
      const page = await request(origin, privateListener);
      await page.body?.cancel();
      if (!page.ok) return `${path}: HTTP ${page.status}`;
      if (!page.headers.get("content-type")?.includes("text/html"))
        return `${path}: expected HTML (check proxy routing)`;
      return null;
    } catch (error) {
      return `${path}: ${networkFailure(error)}`;
    }
  };
  const deadline = Date.now() + 120000;
  let last = "";
  console.log(
    `Checking release health: local ${local.origin}; public ${canonical.origin} (up to 120 seconds).`,
  );
  do {
    const failures: string[] = [];
    for (const [label, origin, privateListener] of [
      ["Local listener", local, true],
      ["Public HTTPS", canonical, false],
    ] as const) {
      const error = await check(origin, privateListener);
      if (error) failures.push(`${label}: ${error}`);
    }
    if (!failures.length) {
      console.log(`Healthy local and public release: ${sha}`);
      return;
    }
    const detail = failures.join("; ");
    if (detail !== last) console.log(`Waiting for release: ${detail}`);
    last = detail;
    if (Date.now() >= deadline) break;
    await new Promise((done) => setTimeout(done, 1000));
  } while (Date.now() < deadline);
  throw new Error(
    `Release health failed: ${last}. Inspect journalctl -u oclr.service and the update log before recovery.`,
  );
}
export async function main(args = process.argv.slice(2)) {
  const [mode, argument] = args;
  if (mode === "health") return health(argument);
  if (!["inspect", "apply"].includes(mode))
    throw new Error("Choose inspect, apply or health.");
  const target = targets();
  console.log(`Database target: ${target.identity}`);
  const client = new Client({
    connectionString: target.migration.toString(),
    connectionTimeoutMillis: 10000,
  });
  const runtime = new Client({
    connectionString: target.runtime.toString(),
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    await runtime.connect();
    const actual = await client.query("SELECT current_database() AS name");
    if (actual.rows[0].name !== required("OCLR_EXPECTED_DB_NAME"))
      throw new Error("Connected database does not match the expected target.");
    await runtime.query("SELECT 1");
    if (mode === "apply") {
      const lock = await client.query(
        "SELECT pg_try_advisory_lock(hashtext('oclr-production-update')) AS acquired",
      );
      if (!lock.rows[0].acquired)
        throw new Error("Another database deployment is running.");
    }
    const data = await pending(client);
    console.log(`Pending migrations: ${data.tags.join(", ") || "none"}`);
    if (mode === "apply") {
      if (!argument || !statSync(argument).isDirectory())
        throw new Error("A private backup directory is required.");
      await backup(target.migration, argument);
      if (data.tags.length) {
        writeFileSync(
          join(argument, "migration.started"),
          `${data.tags.join("\n")}\n`,
          { flag: "wx", mode: 0o600 },
        );
        await migrate(drizzle(client), { migrationsFolder: data.folder });
      }
      if ((await pending(client)).tags.length)
        throw new Error("Migration verification failed.");
      console.log(
        `Applied migrations: ${data.tags.join(", ") || "none (safe no-op)"}`,
      );
    }
  } finally {
    await Promise.allSettled([client.end(), runtime.end()]);
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error: unknown) => {
    // Provider/driver errors can contain connection details or SQL; never echo them.
    const safe =
      error instanceof Error && !("code" in error) && !("cause" in error);
    console.error(
      safe
        ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
        : "Deployment database check failed. Verify the configured target, transport, roles and migrations privately.",
    );
    process.exitCode = 1;
  });
