import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { getPool, closeDb } from "../../src/db";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("database connection recovery", () => {
  beforeAll(() => {
    if (!new URL(url!).pathname.includes("test"))
      throw new Error("Use an isolated test database");
    vi.stubEnv("DATABASE_URL", url!);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("survives a terminated idle backend and establishes a fresh healthy connection", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = getPool();
    const client = await pool.connect();
    const pid = (
      await client.query<{ pid: number }>("select pg_backend_pid() as pid")
    ).rows[0].pid;
    client.release();
    const control = new Pool({ connectionString: url!, max: 1 });
    try {
      await control.query("select pg_terminate_backend($1)", [pid]);
      await vi.waitFor(() =>
        expect(log).toHaveBeenCalledWith(
          "Idle database connection closed; subsequent requests will reconnect.",
        ),
      );
      expect((await pool.query("select 1 as healthy")).rows[0].healthy).toBe(1);
    } finally {
      await control.end();
    }
  });
});
