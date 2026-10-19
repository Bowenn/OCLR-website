import { afterEach, expect, it, vi } from "vitest";
import { appUrl, readJson, requireSameOrigin } from "../../src/lib/http";
import { equalTokens, randomToken } from "../../src/lib/auth/tokens";
afterEach(() => vi.unstubAllEnvs());
it("rejects untrusted origins, missing origins and non-loopback HTTP", () => {
  vi.stubEnv("APP_URL", "https://oclr.example.test");
  expect(() =>
    requireSameOrigin(
      new Request("https://oclr.example.test", { method: "POST" }),
    ),
  ).toThrow();
  expect(() =>
    requireSameOrigin(
      new Request("https://oclr.example.test", {
        method: "POST",
        headers: { origin: "https://attacker.test" },
      }),
    ),
  ).toThrow();
  vi.stubEnv("APP_URL", "http://oclr.example.test");
  expect(() => appUrl()).toThrow();
});
it("bounds body size even when length is absent and validates JSON", async () => {
  await expect(
    readJson(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(32769),
      }),
    ),
  ).rejects.toThrow("too large");
  await expect(
    readJson(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad",
      }),
    ),
  ).rejects.toThrow("invalid JSON");
});
it("requires full entropy tokens before constant time state matching", () => {
  const token = randomToken();
  expect(equalTokens(token, token)).toBe(true);
  expect(equalTokens(token, randomToken())).toBe(false);
  expect(equalTokens("", "")).toBe(false);
});
