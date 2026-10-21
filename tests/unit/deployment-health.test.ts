import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseUrl, main } from "../../scripts/deployment-db";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("explicit database transport", () => {
  it.each(["10.20.0.5", "db.internal.example", "127.0.0.1"])(
    "accepts disabled TLS for the operator-selected host %s in production",
    (host) => {
      vi.stubEnv("OCLR_ENVIRONMENT", "production");
      const url = databaseUrl(
        `postgresql://runtime@${host}:5432/oclr?sslmode=disable`,
      );
      expect(url.searchParams.get("sslmode")).toBe("disable");
    },
  );
  it("preserves verified TLS support", () => {
    expect(
      databaseUrl(
        "postgresql://runtime@db.example/oclr?sslmode=verify-full&sslrootcert=/etc/oclr/db-ca.pem",
      ).searchParams.get("sslmode"),
    ).toBe("verify-full");
  });
  it.each([
    "",
    "?sslmode=prefer",
    "?sslmode=no-verify",
    "?sslmode=disable&sslmode=verify-full",
  ])(
    "rejects missing, ambiguous or unsupported transport options: %s",
    (query) => {
      expect(() =>
        databaseUrl(`postgresql://runtime@db.internal/oclr${query}`),
      ).toThrow("explicit PostgreSQL");
    },
  );
});
describe("update activation health", () => {
  it("requires the exact release and HTML from both the private listener and public HTTPS", async () => {
    const sha = "3".repeat(40);
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    vi.stubEnv("OCLR_BIND_HOST", "127.0.0.1");
    vi.stubEnv("PORT", "3217");
    const fetcher = vi.fn(async (url: URL) =>
      url.pathname === "/api/health"
        ? Response.json({ status: "ok", release: sha })
        : new Response("<html></html>", {
            headers: { "content-type": "text/html" },
          }),
    );
    vi.stubGlobal("fetch", fetcher);
    await main(["health", sha]);
    expect(fetcher.mock.calls.map(([url]) => url.origin)).toEqual([
      "http://127.0.0.1:3217",
      "http://127.0.0.1:3217",
      "https://oclr.example.test",
      "https://oclr.example.test",
    ]);
  });
  it("never accepts a stale proxy release or an unready database", async () => {
    vi.useFakeTimers();
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ status: "ok", release: "4".repeat(40) }),
      ),
    );
    const checked = expect(main(["health", "5".repeat(40)])).rejects.toThrow(
      "Release health failed",
    );
    await vi.runAllTimersAsync();
    await checked;
  });
});
