import { beforeEach, describe, expect, it, vi } from "vitest";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/db", () => ({ db: () => ({ execute }) }));
import { GET } from "../../src/app/api/health/route";
describe("public deployment health", () => {
  beforeEach(() => {
    execute.mockReset();
  });
  it("checks the database without a session and never caches readiness", async () => {
    execute.mockResolvedValue({ rows: [{ value: 1 }] });
    const response = await GET();
    expect(execute).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", release: null });
  });
  it("reports unavailable without exposing SQL, credentials or private error details", async () => {
    execute.mockRejectedValue(new Error("private-database-password"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unavailable",
      release: null,
    });
  });
});
