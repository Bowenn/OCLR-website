import { afterEach, expect, it, vi } from "vitest";
import { frontendResource } from "../../src/lib/frontend-resource";
import { frontendRemoteRead } from "../../src/lib/frontend-data";
import { extendedResources } from "../../src/lib/extended-read-resources";
vi.mock("../../src/lib/frontend-data", () => ({
  frontendConnection: vi.fn(),
  frontendRemoteRead: vi.fn(async () => ({ data: null })),
}));
afterEach(() => vi.clearAllMocks());
const resource = extendedResources.find(
  (item) => item.path.includes("{edition}") && item.path.includes("{osuId}"),
)!;
it.each([undefined, null, "undefined", "null", "", "  ", NaN, {}])(
  "rejects an invalid path value %s before transport",
  async (value) => {
    const error = await frontendResource(resource.id, {
      slug: "synthetic",
      playerId: value,
    }).catch((error) => error);
    expect(error).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    expect(error.message).toContain(resource.id);
    expect(error.message).toContain("osuId");
    expect(frontendRemoteRead).not.toHaveBeenCalled();
  },
);
it("substitutes aliases and encodes each path segment", async () => {
  await frontendResource(resource.id, {
    slug: "synthetic/name",
    playerId: 123,
  });
  const path = resource.path
    .replace("{edition}", "synthetic%2Fname")
    .replace("{osuId}", "123");
  expect(frontendRemoteRead).toHaveBeenCalledWith(
    path,
    expect.any(URLSearchParams),
  );
});
