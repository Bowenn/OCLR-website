import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  announcementsSchema,
  publicAnnouncements,
  publicAnnouncement,
} from "../../src/lib/announcements";
import { announcements } from "../fixtures/announcements";
let scratch: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});
it("publishes only approved, dated announcements and hides unpublished/future content", () => {
  scratch = mkdtempSync(join(tmpdir(), "oclr-news-"));
  const path = join(scratch, "announcements.json");
  writeFileSync(
    path,
    JSON.stringify([
      ...announcements,
      {
        ...announcements[0],
        slug: "future",
        publishedAt: "2099-01-01T00:00:00Z",
      },
    ]),
  );
  vi.stubEnv("OCLR_ANNOUNCEMENTS_FILE", path);
  expect(publicAnnouncements()).toHaveLength(1);
  expect(publicAnnouncement("private-announcement")).toBeUndefined();
  expect(publicAnnouncement("future")).toBeUndefined();
  expect(publicAnnouncement("synthetic-announcement")?.title).toBe(
    "Synthetic test announcement",
  );
});
it("rejects duplicate slugs and published posts without a publication date", () => {
  expect(
    announcementsSchema.safeParse([announcements[0], announcements[0]]).success,
  ).toBe(false);
  expect(
    announcementsSchema.safeParse([{ ...announcements[0], publishedAt: null }])
      .success,
  ).toBe(false);
});
