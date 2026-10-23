import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/db", () => ({
  db: () => {
    throw new Error("Synthetic database outage");
  },
}));
import { defaultSiteAppearance } from "../../src/lib/site-settings";
describe("public appearance recovery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("keeps public rendering available with the original design during a DB outage", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://synthetic/test");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await defaultSiteAppearance()).toBe("default");
    expect(log).toHaveBeenCalledWith(
      "Site appearance is temporarily unavailable; using the original design.",
    );
  });
  it("supports unconfigured local installations without attempting a database read", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await defaultSiteAppearance()).toBe("default");
    expect(log).not.toHaveBeenCalled();
  });
});
