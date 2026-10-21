import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { EventEmitter } from "node:events";
import { databaseUrl, main } from "../../scripts/deployment-db";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
// Mock only the private transport for failure/retry tests. A real local HTTP
// server below verifies that the canonical Host reaches Node's HTTP client.
function privateResponse(
  status: number,
  body: unknown,
  contentType = "application/json",
) {
  vi.spyOn(http, "get").mockImplementation((...args: unknown[]) => {
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Object.assign(new EventEmitter(), {
        statusCode: status,
        headers: { "content-type": contentType },
        destroy() {},
      });
      const callback = args[2] as (response: unknown) => void;
      callback(response);
      response.emit("data", Buffer.from(JSON.stringify(body)));
      response.emit("end");
    });
    return request as http.ClientRequest;
  });
}
const sha = "3".repeat(40);
function publicResponse() {
  return vi.fn(async (url: URL, options?: RequestInit) => {
    expect(options?.redirect).toBe("manual");
    return url.pathname === "/api/health"
      ? Response.json({ status: "ok", release: sha })
      : new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        });
  });
}
async function failsWith(message: string) {
  const checked = expect(main(["health", sha])).rejects.toThrow(message);
  await vi.runAllTimersAsync();
  await checked;
}
describe("update activation health", () => {
  it.each([
    ["0.0.0.0", "127.0.0.1"],
    ["::", "[::1]"],
  ])(
    "checks wildcard %s through its matching loopback address",
    async (host, address) => {
      vi.stubEnv("APP_URL", "https://oclr.example.test");
      vi.stubEnv("OCLR_BIND_HOST", host);
      privateResponse(
        200,
        { status: "ok", release: sha },
        "application/json text/html",
      );
      vi.stubGlobal("fetch", publicResponse());
      await main(["health", sha]);
      expect(vi.mocked(http.get).mock.calls[0][0]).toHaveProperty(
        "hostname",
        address,
      );
    },
  );
  it("sends the canonical Host to a real private listener, without following redirects", async () => {
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    vi.stubEnv("OCLR_BIND_HOST", "127.0.0.1");
    const seen: string[] = [];
    const server = http.createServer((request, response) => {
      seen.push(`${request.headers.host} ${request.url?.split("?")[0]}`);
      if (request.headers.host !== "oclr.example.test") {
        response
          .writeHead(308, { Location: "https://oclr.example.test" })
          .end();
      } else if (request.url?.startsWith("/api/health")) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "ok", release: sha }));
      } else
        response
          .writeHead(200, { "content-type": "text/html" })
          .end("<html></html>");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No test listener.");
      vi.stubEnv("PORT", String(address.port));
      const fetcher = publicResponse();
      vi.stubGlobal("fetch", fetcher);
      await main(["health", sha]);
      expect(seen).toEqual([
        "oclr.example.test /api/health",
        "oclr.example.test /",
      ]);
      expect(fetcher.mock.calls.map(([url]) => url.origin)).toEqual([
        "https://oclr.example.test",
        "https://oclr.example.test",
      ]);
      expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
  it.each([
    [
      503,
      { status: "unavailable", release: sha },
      "Local listener: /api/health: HTTP 503",
    ],
    [
      200,
      { status: "unavailable", release: sha },
      "application/database not ready",
    ],
    [
      200,
      { status: "ok", release: "4".repeat(40) },
      "Local listener: /api/health: release SHA mismatch",
    ],
    [308, {}, "unexpected redirect"],
  ])(
    "diagnoses private health HTTP %s without accepting an unready release",
    async (status, body, message) => {
      vi.useFakeTimers();
      vi.stubEnv("APP_URL", "https://oclr.example.test");
      privateResponse(status, body);
      vi.stubGlobal("fetch", publicResponse());
      await failsWith(message);
    },
  );
  it("identifies public HTTPS failures independently and redacts arbitrary provider messages", async () => {
    vi.useFakeTimers();
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    privateResponse(
      200,
      { status: "ok", release: sha },
      "application/json text/html",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("synthetic-secret-not-for-logs", {
          cause: { code: "CERT_HAS_EXPIRED" },
        });
      }),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await failsWith(
      "Public HTTPS: /api/health: connection failed (CERT_HAS_EXPIRED)",
    );
    expect(log.mock.calls.flat().join(" ")).not.toContain("synthetic-secret");
  });
  it("does not accept stale public proxy releases, redirects or non-HTML pages", async () => {
    vi.useFakeTimers();
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    privateResponse(
      200,
      { status: "ok", release: sha },
      "application/json text/html",
    );
    for (const [response, message] of [
      [
        () => Response.json({ status: "ok", release: "4".repeat(40) }),
        "Public HTTPS: /api/health: release SHA mismatch",
      ],
      [
        () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://untrusted.invalid" },
          }),
        "Public HTTPS: /api/health: HTTP 302",
      ],
      [() => new Response("not-json"), "invalid JSON"],
    ] as const) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response()),
      );
      await failsWith(message);
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.pathname === "/api/health"
          ? Response.json({ status: "ok", release: sha })
          : new Response("wrong page"),
      ),
    );
    await failsWith("Public HTTPS: /: expected HTML");
  });
  it("allows slow startup to become ready within its bounded retry window", async () => {
    vi.useFakeTimers();
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    privateResponse(
      200,
      { status: "ok", release: sha },
      "application/json text/html",
    );
    const ready = publicResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        Date.now() < 30000
          ? new Response(null, { status: 503 })
          : ready(url, { redirect: "manual" }),
      ),
    );
    vi.setSystemTime(0);
    const checked = main(["health", sha]);
    await vi.runAllTimersAsync();
    await checked;
    expect(Date.now()).toBeGreaterThanOrEqual(30000);
    expect(Date.now()).toBeLessThan(120000);
  });
});
