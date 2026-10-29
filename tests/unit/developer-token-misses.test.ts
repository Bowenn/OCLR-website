import { afterEach, expect, it, vi } from "vitest";
import { DeveloperTokenMisses } from "../../src/lib/developer-token-misses";
const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/db", () => ({ db: () => database }));
afterEach(() => vi.restoreAllMocks());
it("expires misses and evicts rather than rejecting unrelated fingerprints at capacity", () => {
  const entries = new Map<string, number>();
  const cache = new DeveloperTokenMisses(entries);
  cache.remember("one", 100);
  expect(cache.has("one", 60_099)).toBe(true);
  expect(cache.has("one", 60_100)).toBe(false);
  for (let n = 0; n < 5000; n++) cache.remember(String(n), 100);
  expect(entries.size).toBe(4096);
  expect(cache.has("unrelated", 100)).toBe(false);
});
it("rejects a repeated unknown token before another database transaction", async () => {
  const select = {
    from: () => select,
    innerJoin: () => select,
    where: () => select,
    limit: async () => [],
  };
  database.transaction.mockImplementation(async (callback) =>
    callback({ execute: async () => {}, select: () => select }),
  );
  const { authenticateDeveloperRead } =
    await import("../../src/lib/developer-api");
  const request = new Request("https://oclr.example/api/v1/me", {
    headers: { authorization: `Bearer oclr_dev_${"X".repeat(43)}` },
  });
  for (let n = 0; n < 3; n++)
    await expect(
      authenticateDeveloperRead(request, "identity:read"),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_TOKEN" });
  expect(database.transaction).toHaveBeenCalledTimes(1);
});
