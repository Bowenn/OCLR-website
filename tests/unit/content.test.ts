import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicEdition, getPublicEditions } from "../../src/lib/content";
import { edition } from "../fixtures/edition";
const original = process.env.OCLR_EDITIONS_FILE;
const scratch = mkdtempSync(join(tmpdir(), "oclr-content-"));
afterEach(() => {
  if (original === undefined) delete process.env.OCLR_EDITIONS_FILE;
  else process.env.OCLR_EDITIONS_FILE = original;
  rmSync(scratch, { recursive: true, force: true });
});
it("excludes unpublished editions and resolves stable public slugs", () => {
  const file = join(scratch, "editions.json");
  writeFileSync(
    file,
    JSON.stringify([edition, { ...edition, slug: "hidden", published: false }]),
  );
  process.env.OCLR_EDITIONS_FILE = file;
  expect(getPublicEditions()).toHaveLength(1);
  expect(getPublicEdition("hidden")).toBeUndefined();
  expect(getPublicEdition("test-cup")?.rules?.version).toBe("test-v1");
});
