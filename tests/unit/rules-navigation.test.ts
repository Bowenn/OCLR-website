import { describe, expect, it } from "vitest";
import { rulesSectionIds } from "../../src/lib/rules-navigation";
describe("rules heading anchors", () => {
  it("retains Chinese and normalizes fullwidth characters", () => {
    expect(rulesSectionIds(["比赛规则", "Ｒｕｌｅｓ & Eligibility"])).toEqual([
      "rule-比赛规则",
      "rule-rules-eligibility",
    ]);
  });
  it("is stable and avoids duplicate and slug-collision IDs", () => {
    const headings = ["Rules", "Rules", "Rules-2", "!", "!", "RULES"];
    const ids = rulesSectionIds(headings);
    expect(new Set(ids).size).toBe(headings.length);
    expect(ids).toEqual(rulesSectionIds(headings));
    expect(ids).toEqual([
      "rule-rules",
      "rule-rules-2",
      "rule-rules-2-2",
      "rule-section",
      "rule-section-2",
      "rule-rules-3",
    ]);
  });
  it("bounds long headings and safely retains text-derived anchors", () => {
    const ids = rulesSectionIds(["x".repeat(500), "<script>alert(1)</script>"]);
    expect(ids[0].length).toBeLessThan(90);
    expect(ids[1]).not.toContain("<");
  });
});
