import { describe, expect, it } from "vitest";
import {
  projectPublicNews,
  type NewsEdition,
} from "../../src/lib/public-news-model";
import { edition } from "../fixtures/edition";
import { announcements } from "../fixtures/announcements";
const now = new Date("2026-10-20T12:00:00Z");
const record: NewsEdition = {
  edition: {
    ...edition,
    schedule: [
      { label: "Captain draft", at: "2026-11-01T12:00:00Z" },
      { label: "Final", at: null },
    ],
  },
  locked: false,
};
describe("read-only deterministic public News", () => {
  it("deduplicates stable event URLs across reads and schedule reordering, keeping manual news", () => {
    const items = projectPublicNews([record], [], announcements, true, now);
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
    expect(items).toEqual(
      projectPublicNews([record], [], announcements, true, now),
    );
    const duplicate = {
      ...record,
      edition: {
        ...record.edition,
        schedule: [
          ...record.edition.schedule,
          ...record.edition.schedule,
        ].reverse(),
      },
    };
    expect(
      projectPublicNews([duplicate], [], announcements, true, now),
    ).toEqual(items);
    expect(items.some((i) => i.slug === "synthetic-announcement")).toBe(true);
    expect(JSON.stringify(items)).not.toContain("Hidden editorial");
  });
  it("does not expose unpublished edition dates or turn arbitrary labels/planned dates into completion", () => {
    expect(
      projectPublicNews(
        [{ ...record, edition: { ...record.edition, published: false } }],
        [],
        [],
        true,
        now,
      ),
    ).toEqual([]);
    const item = projectPublicNews([record], [], [], true, now).find(
      (i) => i.kind === "schedule",
    )!;
    expect(item.future).toBe(true);
    expect(item.title).toBe(
      "Scheduled: Captain draft — Synthetic test edition",
    );
    const past = projectPublicNews(
      [record],
      [],
      [],
      true,
      new Date("2026-12-01T00:00:00Z"),
    ).find((i) => i.kind === "schedule")!;
    expect(past.slug).toBe(item.slug);
    expect(past.title).toBe(item.title);
    expect(past.future).toBe(false);
    expect(past.summary).toContain("plan, not confirmation");
    expect(item.summary).toContain("Asia/Taipei");
  });
  it("claims open registration only within its enabled window with privacy, active state and no lock", () => {
    const title = (r = record, privacy = true, time = now) =>
      projectPublicNews([r], [], [], privacy, time).find(
        (i) =>
          i.kind === "registration" &&
          i.summary.startsWith("Configured registration window:"),
      )!;
    const open = title();
    expect(open.title).toContain("Registration is open");
    for (const r of [
      { ...record, locked: true },
      {
        ...record,
        edition: { ...record.edition, status: "completed" as const },
      },
      {
        ...record,
        edition: {
          ...record.edition,
          registration: { ...edition.registration!, enabled: false },
        },
      },
    ])
      expect(title(r).title).not.toContain("is open");
    expect(title(record, false).title).not.toContain("is open");
    const future = title(record, true, new Date("2024-01-01T00:00:00Z"));
    expect(future.title).not.toContain("is open");
    expect(future.future).toBe(true);
    expect(future.slug).toBe(open.slug);
    expect(
      title(record, true, new Date(edition.registration!.closesAt)).title,
    ).not.toContain("is open");
  });
  it("withholds future publication timestamps and sorts upcoming plans chronologically after dated updates", () => {
    const event = {
      editionSlug: edition.slug,
      kind: "result" as const,
      id: "fixture-1",
      title: "Result published",
      summary: "Approved score",
      at: "2026-10-19T00:00:00Z",
      url: "/tournaments/test-cup/results",
    };
    const items = projectPublicNews(
      [record],
      [event, event, { ...event, id: "future", at: "2099-01-02T00:00:00Z" }],
      announcements,
      true,
      now,
    );
    expect(items.filter((i) => i.kind === "result")).toHaveLength(1);
    expect(items[0].kind).toBe("result");
    const future = items.filter((i) => i.future);
    expect(future.map((i) => Date.parse(i.at))).toEqual(
      future.map((i) => Date.parse(i.at)).sort((a, b) => a - b),
    );
  });
});
