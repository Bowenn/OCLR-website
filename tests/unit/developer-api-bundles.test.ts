import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  (
    globalThis as unknown as {
      oclrAnonymousReadWindows?: Map<string, unknown>;
    }
  ).oclrAnonymousReadWindows?.clear();
  vi.unstubAllEnvs();
});

it("shares quotas across route module generations while preserving HTTP 429 and Retry-After", async () => {
  vi.stubEnv("APP_URL", "https://oclr.example");
  vi.stubEnv("OCLR_DEVELOPER_ORIGINS", "http://localhost:3000");
  const first = await import("../../src/lib/developer-api");
  const http = await import("../../src/lib/developer-api-http");
  for (let n = 0; n < 600; n++)
    await http.readDataResponse(
      new Request("https://oclr.example/api/v1/site"),
      "tournaments:read",
      () => ({ data: null }),
      { anonymous: true },
    );
  vi.resetModules();
  const next = await import("../../src/lib/developer-api");
  expect(next.DeveloperApiError).not.toBe(first.DeveloperApiError);
  const { readDataResponse } = await import("../../src/lib/developer-api-http");
  const response = await readDataResponse(
    new Request("https://oclr.example/api/v1/site", {
      headers: { Origin: "http://localhost:3000" },
    }),
    "tournaments:read",
    () => ({ data: null }),
    { anonymous: true },
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  const body = await response.json();
  expect(body.error.code).toBe("RATE_LIMITED");
  expect(body.error.requestId).toBe(response.headers.get("x-request-id"));
});

it("anonymous exhaustion cannot consume authenticated quotas", async () => {
  vi.stubEnv("APP_URL", "https://oclr.example");
  const { readDataResponse } = await import("../../src/lib/developer-api-http");
  const { developerApiLimiter } = await import("../../src/lib/developer-api");
  for (let n = 0; n < 601; n++)
    await readDataResponse(
      new Request("https://oclr.example/api/v1/site"),
      "tournaments:read",
      () => ({ data: null }),
      { anonymous: true },
    );
  expect(() =>
    developerApiLimiter.take("read:synthetic-valid-token", 120),
  ).not.toThrow();
  const invalid = await readDataResponse(
    new Request("https://oclr.example/api/v1/me", {
      headers: { authorization: "Bearer malformed" },
    }),
    "identity:read",
    () => ({ data: null }),
  );
  expect(invalid.status).toBe(401);
});
