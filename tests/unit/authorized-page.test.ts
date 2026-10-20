import { describe, expect, it, vi } from "vitest";
import { authorizedPage } from "../../src/lib/auth/page";
import { HttpError } from "../../src/lib/http";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`TEST_REDIRECT:${path}`);
  },
}));
describe("server page authorization responses", () => {
  it("returns authorized content and hides denied or missing resources", async () => {
    expect(await authorizedPage(async () => "Authorized content")).toBe(
      "Authorized content",
    );
    for (const status of [403, 404])
      await expect(
        authorizedPage(async () => {
          throw new HttpError(status, "Private details");
        }),
      ).rejects.toThrow("TEST_NOT_FOUND");
    await expect(
      authorizedPage(async () => {
        throw new HttpError(401, "Login required");
      }),
    ).rejects.toThrow("TEST_REDIRECT:/login");
  });
  it("does not swallow database outages or framework navigation responses", async () => {
    const failure = new Error("Synthetic database outage");
    await expect(
      authorizedPage(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
