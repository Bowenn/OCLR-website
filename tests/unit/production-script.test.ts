import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/production.mjs", import.meta.url),
);
function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 5000,
  });
}
describe("production operator commands", () => {
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
  it("rejects unexpected arguments and invalid ports before starting anything", () => {
    expect(run(["setup", "--force"]).status).toBe(1);
    const result = run(["start", "--dry-run"], { PORT: "3000;bad" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
