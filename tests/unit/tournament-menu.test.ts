import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("../../src/lib/content", () => ({ getPublicEditions: vi.fn() }));
vi.mock("../../src/lib/registrations", () => ({
  registrationAvailability: vi.fn(),
}));
import { GET } from "../../src/app/api/tournaments/route";
import { getPublicEditions } from "../../src/lib/content";
import { registrationAvailability } from "../../src/lib/registrations";
import { edition } from "../fixtures/edition";
afterEach(() => vi.clearAllMocks());
describe("bounded public tournament navigation projection", () => {
  it.each([0, 1, 8])(
    "returns %i published destinations without loading per-edition operational status",
    async (count) => {
      const rows = Array.from({ length: count }, (_, i) => ({
        ...edition,
        slug: `public-${i}`,
        name: `Synthetic published ${i}`,
      }));
      vi.mocked(getPublicEditions).mockResolvedValue(rows);
      const response = await GET(
        new Request("http://localhost/api/tournaments?navigation=1"),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        rows.map(({ slug, name, season }) => ({ slug, name, season })),
      );
      expect(registrationAvailability).not.toHaveBeenCalled();
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
});
