import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  mkdtempSync,
  writeFileSync,
  symlinkSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/production.sh", import.meta.url),
);
function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync("/bin/bash", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 5000,
  });
}
describe("production operator commands", () => {
  function simulatedSetup(failMigration = false, action = "setup") {
    const directory = mkdtempSync(join(tmpdir(), "oclr-shell-deploy-"));
    try {
      const log = join(directory, "commands.log");
      symlinkSync(process.execPath, join(directory, "node"));
      writeFileSync(
        join(directory, "npm"),
        `#!/bin/bash
role=runtime
[[ "$DATABASE_URL" == *migrator* ]] && role=migration
printf '%s|%s|%s\\n' "$*" "$role" "\${MIGRATION_DATABASE_URL-unset}" >> "$COMMAND_LOG"
if [[ "$*" == 'run db:migrate' && "$FAIL_MIGRATION" == yes ]]; then exit 7; fi
exit 0
`,
        { mode: 0o700 },
      );
      const result = run([action, "--apply"], {
        PATH: directory,
        DATABASE_URL: "postgres://runtime@db.invalid/oclr",
        MIGRATION_DATABASE_URL: "postgres://migrator@db.invalid/oclr",
        APP_URL: "https://oclr.example.test",
        COMMAND_LOG: log,
        FAIL_MIGRATION: failMigration ? "yes" : "no",
      });
      return { result, calls: readFileSync(log, "utf8").trim().split("\n") };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  it("uses migration credentials only for migrations, without exporting or logging the secret", () => {
    const { result, calls } = simulatedSetup();
    expect(result.status).toBe(0);
    expect(calls).toEqual([
      "ci --include=dev|runtime|unset",
      "run db:migrate|migration|unset",
      "run release:check|runtime|unset",
      "run build|runtime|unset",
    ]);
    expect(result.stdout + result.stderr).not.toContain("postgres://");
  });
  it("prepares a candidate without exposing migration credentials or changing the database", () => {
    const { result, calls } = simulatedSetup(false, "prepare");
    expect(result.status).toBe(0);
    expect(calls).toEqual([
      "ci --include=dev|runtime|unset",
      "run check|runtime|unset",
      "run build|runtime|unset",
    ]);
  });
  it("stops on failed migration and never reaches release checking or build", () => {
    const { result, calls } = simulatedSetup(true);
    expect(result.status).toBe(7);
    expect(calls).toHaveLength(2);
    expect(result.stderr).toContain("later steps were not run");
  });
  it("rejects missing migration credentials before installing anything", () => {
    const result = run(["setup", "--apply"], {
      DATABASE_URL: "postgres://runtime@db.invalid/oclr",
      APP_URL: "https://oclr.example.test",
      MIGRATION_DATABASE_URL: "",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("requires MIGRATION_DATABASE_URL");
  });
  it("previews setup without reading environment files, connecting to PostgreSQL or starting npm", () => {
    const result = run(["setup", "--dry-run"], {
      PATH: "/nonexistent",
      DATABASE_URL: "invalid",
      OSU_CLIENT_SECRET: "must-never-be-printed",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("npm ci --include=dev");
    expect(result.stdout.indexOf("db:migrate")).toBeLessThan(
      result.stdout.indexOf("release:check"),
    );
    expect(result.stdout.indexOf("release:check")).toBeLessThan(
      result.stdout.indexOf("npm run build"),
    );
    expect(result.stdout + result.stderr).not.toContain(
      "must-never-be-printed",
    );
  });
  it("starts the existing build behind loopback without running migrations", () => {
    const result = run(["start", "--dry-run"], {
      PORT: "3210",
      OCLR_BIND_HOST: "127.0.0.1",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--hostname 127.0.0.1 --port 3210");
    expect(result.stdout).toContain("release:check");
    expect(result.stdout).not.toMatch(/db:migrate|npm ci|run build/);
  });
  it("requires explicit opt-in before setup can install dependencies or migrate", () => {
    const result = run(["setup"], { PATH: "/nonexistent" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("--apply");
  });
  it("rejects unexpected arguments and invalid ports before starting anything", () => {
    expect(run(["setup", "--force"]).status).toBe(1);
    const result = run(["start", "--dry-run"], { PORT: "3000;bad" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
