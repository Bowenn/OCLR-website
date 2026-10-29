import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
afterEach(() => vi.unstubAllEnvs());
it("redirects untrusted hosts only to the configured canonical origin", () => {
  vi.stubEnv("APP_URL", "https://oclr.example.test");
  const response = proxy(
    new NextRequest("https://attacker.test/tournaments?x=1", {
      headers: { host: "attacker.test" },
    }),
  );
  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(
    "https://oclr.example.test/tournaments?x=1",
  );
});
it("generates fresh strict script nonces, HSTS and no-store API responses", () => {
  vi.stubEnv("APP_URL", "https://oclr.example.test");
  const request = () =>
    new NextRequest("https://oclr.example.test/api/me", {
      headers: { host: "oclr.example.test", "x-nonce": "attacker-input" },
    });
  const a = proxy(request());
  const b = proxy(request());
  expect(a.headers.get("content-security-policy")).not.toBe(
    b.headers.get("content-security-policy"),
  );
  expect(a.headers.get("content-security-policy")).not.toContain(
    "attacker-input",
  );
  expect(a.headers.get("content-security-policy")).toContain(
    "'strict-dynamic'",
  );
  expect(a.headers.get("strict-transport-security")).toContain("31536000");
  expect(a.headers.get("cache-control")).toBe("no-store");
});
it("rejects invalid canonical URLs without exposing userinfo or issuing a redirect", () => {
  vi.stubEnv(
    "APP_URL",
    "https://username:synthetic-private-value@oclr.example.test",
  );
  const response = proxy(
    new NextRequest("https://oclr.example.test/", {
      headers: { host: "oclr.example.test" },
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("location")).toBeNull();
});

it("allows object URLs only as images, retaining script/connect/object restrictions (#440)", () => {
  const response = proxy(
    new NextRequest("http://localhost:3000/", {
      headers: { host: "localhost:3000" },
    }),
  );
  const directives = response.headers
    .get("content-security-policy")!
    .split("; ");
  expect(directives.find((d) => d.startsWith("img-src "))).toContain("blob:");
  expect(
    directives.filter((d) => !d.startsWith("img-src ")).join("; "),
  ).not.toContain("blob:");
  expect(directives).toContain("object-src 'none'");
  expect(directives).toContain("connect-src 'self'");
});
