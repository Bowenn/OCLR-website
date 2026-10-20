import { afterEach, expect, it, vi } from "vitest";
import {
  getEditions,
  getPublicEdition,
  getPublicEditions,
} from "../../src/lib/content";
afterEach(() => vi.unstubAllEnvs());
it("returns an empty unconfigured installation without loading legacy JSON", async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("OCLR_EDITIONS_FILE", "/this-obsolete-file-must-not-be-read.json");
  expect(await getEditions()).toEqual([]);
  expect(await getPublicEditions()).toEqual([]);
  expect(await getPublicEdition("s11")).toBeUndefined();
});
