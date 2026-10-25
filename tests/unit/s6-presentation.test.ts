import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { editionSchema } from "../../src/lib/editions";
import {
  historicalRulebook,
  historicalRulebookSeason,
} from "../../src/lib/historical-rulebooks";
import { archiveKeyVisual } from "../../src/lib/archive-key-visual";
import s9 from "../../src/content/s9-rulebook.json";

const archive = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s6-confirmed-archive.json", "utf8")),
);
const rules = editionSchema.shape.rules.parse(
  JSON.parse(readFileSync("docs/imports/s6-configured-rules.json", "utf8")),
)!;

it("uses the saved S6 section editor only for its evidenced source pair", () => {
  expect(historicalRulebook(archive, rules)?.sections).toEqual(rules.sections);
  expect(historicalRulebookSeason(historicalRulebook(archive, rules)!)).toBe(
    "6",
  );
  expect(
    historicalRulebook({ ...archive, editionSlug: "renamed" }, rules)?.sections,
  ).toEqual(rules.sections);
  expect(
    historicalRulebook(
      { ...archive, sourceUrl: "https://example.com/another-season" },
      rules,
    ),
  ).toBeNull();
  expect(historicalRulebook({ ...archive, links: [] }, rules)).toBeNull();
  expect(historicalRulebook(archive)).toBeNull();
  const s9Archive = historicalArchiveSchema.parse(
    JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
  );
  expect(historicalRulebook(s9Archive, rules)).toBe(s9);
});

it("preserves all supplied rule sections and labels the obsolete group proposal", () => {
  expect(rules.sections).toHaveLength(14);
  const text = rules.sections.map((s) => s.body).join("\n");
  for (const fact of [
    "BO9 2Ban",
    "BO11 2Ban",
    "BO13 2Ban",
    "无法选择相同MOD",
    "不得超过5分钟",
    "15分钟",
    "60秒，90秒，120秒",
    "2天",
    "4轮的瑞士轮",
    "!mp start 30",
    "第一轮最后选择的队伍将连续选两名选手",
  ])
    expect(text).toContain(fact);
  expect(
    rules.sections.find((s) => s.heading === "比赛流程：小组赛")!.body,
  ).toMatch(/已废止[\s\S]*两个小组[\s\S]*现行规则[\s\S]*4轮的瑞士轮/);
});

it("accepts the original S6 image in both branding slots and minimal read summaries", () => {
  expect(
    editionSchema.shape.branding.parse({
      logo: "/archive/s6/key-visual.jpg",
      keyVisual: "/archive/s6/key-visual.jpg",
      background: null,
    }),
  ).toBeTruthy();
  expect(archiveKeyVisual({ sourceUrl: archive.sourceUrl }, null)).toEqual({
    src: "/archive/s6/key-visual.jpg",
    width: 1920,
    height: 1080,
  });
  expect(
    archiveKeyVisual(
      { sourceUrl: archive.sourceUrl },
      "/archive/s7/key-visual.jpg",
    )?.src,
  ).toBe("/archive/s7/key-visual.jpg");
});
