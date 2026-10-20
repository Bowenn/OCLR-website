import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const config = new URL("../../drizzle.config.ts", import.meta.url).href;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function credentials(
  files: Record<string, string>,
  overrides: {
    DATABASE_URL?: string;
    NODE_ENV?: NodeJS.ProcessEnv["NODE_ENV"];
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "oclr-drizzle-env-test-"));
  directories.push(directory);
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(directory, name), content, { mode: 0o600 });
  const env = { ...process.env };
  delete env.DATABASE_URL;
  Reflect.deleteProperty(env, "NODE_ENV");
  delete env.__NEXT_PROCESSED_ENV;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `process.chdir(${JSON.stringify(directory)}); const { default: config } = await import(${JSON.stringify(config)}); console.log(JSON.stringify(config.dbCredentials));`,
    ],
    { env: { ...env, ...overrides }, encoding: "utf8", timeout: 10000 },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { url: string };
}

describe("Drizzle CLI environment configuration", () => {
  it("loads local Next.js configuration and expands variables without shell exports", () => {
    expect(
      credentials({
        ".env": "DATABASE_URL=postgres://base.test/base_fixture\n",
        ".env.local":
          "LOCAL_DATABASE=local_fixture\nDATABASE_URL=postgres://local.test/$LOCAL_DATABASE\n",
      }),
    ).toEqual({ url: "postgres://local.test/local_fixture" });
  });

  it("keeps an explicitly exported database ahead of local configuration", () => {
    expect(
      credentials(
        { ".env.local": "DATABASE_URL=postgres://local.test/local_fixture\n" },
        { DATABASE_URL: "postgres://explicit.test/explicit_fixture" },
      ),
    ).toEqual({ url: "postgres://explicit.test/explicit_fixture" });
  });

  it("selects development files by default and production files only when configured", () => {
    const files = {
      ".env.local": "DATABASE_URL=postgres://local.test/local_fixture\n",
      ".env.development.local":
        "DATABASE_URL=postgres://development.test/development_fixture\n",
      ".env.production.local":
        "DATABASE_URL=postgres://production.test/production_fixture\n",
    };
    expect(credentials(files)).toEqual({
      url: "postgres://development.test/development_fixture",
    });
    expect(credentials(files, { NODE_ENV: "production" })).toEqual({
      url: "postgres://production.test/production_fixture",
    });
  });
});
