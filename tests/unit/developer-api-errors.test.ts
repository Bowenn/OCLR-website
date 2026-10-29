import { afterEach, expect, it, vi } from "vitest";
import { readDataResponse } from "../../src/lib/developer-api-http";
import { HttpError } from "../../src/lib/http";
afterEach(() => vi.unstubAllEnvs());
it.each(["GET", "HEAD"])(
  "classifies a service HttpError(429) consistently for %s",
  async (method) => {
    vi.stubEnv("APP_URL", "https://oclr.example");
    const response = await readDataResponse(
      new Request("https://oclr.example/api/v1/site", { method }),
      "tournaments:read",
      () => {
        throw new HttpError(429, "Busy");
      },
      { anonymous: true },
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    if (method === "HEAD") expect(await response.text()).toBe("");
    else
      expect((await response.json()).error).toMatchObject({
        code: "RATE_LIMITED",
        message: "Busy",
        requestId: response.headers.get("x-request-id"),
      });
  },
);
