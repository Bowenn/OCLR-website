import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/desktop/v1/auth/decision/route";
import { requireUser } from "../../src/lib/auth/user";
import { approveDesktopAuthorization } from "../../src/lib/desktop-auth";
import { HttpError } from "../../src/lib/http";

vi.mock("../../src/lib/auth/user", () => ({ requireUser: vi.fn() }));
vi.mock("../../src/lib/desktop-auth", async (original) => ({
  ...(await original<typeof import("../../src/lib/desktop-auth")>()),
  approveDesktopAuthorization: vi.fn(),
}));
const actor = { osuId: 443001, username: "Aster" };
const id = "b0783707-9125-4318-a5c3-25ab0c26843f";
const origin = "https://oclr.example.test";
const input = `request_id=${id}&decision=approve`;
const callback = "http://127.0.0.1:49152/oclr/callback?code=synthetic";
function request(body: BodyInit, headers: Record<string, string> = {}) {
  const init: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      ...headers,
    },
    body,
    duplex: "half",
  };
  return new Request(`${origin}/api/desktop/v1/auth/decision`, init);
}
beforeEach(() => {
  vi.stubEnv("APP_URL", origin);
  vi.mocked(requireUser).mockResolvedValue(actor);
  vi.mocked(approveDesktopAuthorization).mockResolvedValue(callback);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("accepts the consent form and redirects only to the service's saved callback", async () => {
  const response = await POST(request(input));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(callback);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(approveDesktopAuthorization).toHaveBeenCalledWith(actor, id, true);
});
it.each<Record<string, string>>([{}, { "content-length": "1" }])(
  "cancels oversized consent streams without trusting Content-Length (%j)",
  async (headers) => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(input.padEnd(2048, "&")));
        controller.enqueue(new TextEncoder().encode("&"));
      },
      cancel,
    });
    const response = await POST(request(stream, headers));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(approveDesktopAuthorization).not.toHaveBeenCalled();
  },
);
it("checks origin and browser authentication before reading consent input", async () => {
  const crossOrigin = request(input, { origin: "https://attacker.test" });
  const readCrossOrigin = vi.spyOn(crossOrigin.body!, "getReader");
  expect((await POST(crossOrigin)).status).toBe(403);
  expect(requireUser).not.toHaveBeenCalled();
  expect(readCrossOrigin).not.toHaveBeenCalled();
  const unauthenticated = request(input);
  const readUnauthenticated = vi.spyOn(unauthenticated.body!, "getReader");
  vi.mocked(requireUser).mockRejectedValueOnce(new HttpError(401, "Sign in"));
  expect((await POST(unauthenticated)).status).toBe(401);
  expect(readUnauthenticated).not.toHaveBeenCalled();
  expect(approveDesktopAuthorization).not.toHaveBeenCalled();
});
it("rejects unexpected media types and ambiguous repeated consent fields", async () => {
  expect(
    (await POST(request(input, { "content-type": "text/plain" }))).status,
  ).toBe(400);
  expect((await POST(request(`${input}&decision=deny`))).status).toBe(400);
  expect(approveDesktopAuthorization).not.toHaveBeenCalled();
});
