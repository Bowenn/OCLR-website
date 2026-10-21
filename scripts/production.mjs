#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const [action, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const usage = "Usage: node scripts/production.mjs setup|start [--dry-run]";

// The migration secret is used only for the migration subprocess, never Next.js.
let migrationUrl = process.env.MIGRATION_DATABASE_URL;
delete process.env.MIGRATION_DATABASE_URL;
async function run(command, args, overrides = {}) {
  console.log(
    `> ${command === process.execPath ? "node" : command} ${args.join(" ")}`,
  );
  if (dryRun) return;
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...overrides },
      shell: false,
    });
    const terminate = () => child.kill("SIGTERM");
    const interrupt = () => child.kill("SIGINT");
    process.once("SIGTERM", terminate);
    process.once("SIGINT", interrupt);
    const cleanup = () => {
      process.removeListener("SIGTERM", terminate);
      process.removeListener("SIGINT", interrupt);
    };
    child.once("error", () => {
      cleanup();
      reject(
        new Error(
          "Could not start the production command. Check Node.js/npm installation.",
        ),
      );
    });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else {
        process.exitCode =
          signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : code || 1;
        reject(
          new Error("Production command stopped; later steps were not run."),
        );
      }
    });
  });
}

try {
  if (
    !["setup", "start"].includes(action) ||
    flags.some((flag) => flag !== "--dry-run")
  )
    throw new Error(usage);
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw new Error("Use Node.js >=22.13 (Node.js 24 LTS recommended).");
  process.env.NODE_ENV = "production";
  if (action === "setup") await run("npm", ["ci", "--include=dev"]);
  if (!dryRun) {
    // Match Next.js production environment loading; existing process variables win.
    const nextEnv = await import("@next/env");
    (nextEnv.default ?? nextEnv).loadEnvConfig(root, false);
    migrationUrl = process.env.MIGRATION_DATABASE_URL ?? migrationUrl;
    delete process.env.MIGRATION_DATABASE_URL;
  }
  if (action === "setup") {
    // Run once per release, after a database backup. Never import legacy JSON,
    // create accounts, publish content or roll back migrations automatically.
    if (!dryRun && (!migrationUrl || !process.env.DATABASE_URL))
      throw new Error(
        "Setup requires MIGRATION_DATABASE_URL and the runtime DATABASE_URL. Inject migration credentials only for this release command.",
      );
    await run(
      "npm",
      ["run", "db:migrate"],
      migrationUrl ? { DATABASE_URL: migrationUrl } : {},
    );
    await run("npm", ["run", "release:check"]);
    await run("npm", ["run", "build"]);
    console.log(
      dryRun
        ? "Setup preview only; no commands executed."
        : "Setup complete. Start with npm run production:start.",
    );
  } else {
    const port = process.env.PORT ?? "3000";
    const host = process.env.OCLR_BIND_HOST ?? "127.0.0.1";
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      throw new Error("PORT must be an integer from 1 to 65535.");
    if (!/^[a-zA-Z0-9.:_-]+$/.test(host))
      throw new Error("OCLR_BIND_HOST must be a host name or IP address.");
    if (!dryRun && !existsSync(join(root, ".next", "BUILD_ID")))
      throw new Error(
        "No production build found. Run npm run production:setup first.",
      );
    await run("npm", ["run", "release:check"]);
    await run(process.execPath, [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      host,
      "--port",
      port,
    ]);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Production command failed.",
  );
  process.exitCode ||= 1;
}
