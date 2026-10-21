import { expect, test } from "@playwright/test";

test("anonymous readiness is read-only and does not expose database details", async ({
  request,
}) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    "Requires the isolated database-backed server",
  );
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toEqual({ status: "ok", release: null });
  expect((await request.post("/api/health", { data: {} })).status()).toBe(405);
});
