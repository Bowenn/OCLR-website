import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { historicalRulebook } from "../../src/lib/historical-rulebooks";
import s9 from "../../src/content/s9-rulebook.json";

const archive = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
);
describe("S9 historical rulebook supplement", () => {
  it("requires both the S9 source workbook and the organizer's rulebook identity", () => {
    expect(historicalRulebook(archive)).toBe(s9);
    expect(
      historicalRulebook({ ...archive, editionSlug: "preview-copy" }),
    ).toBe(s9);
    expect(
      historicalRulebook({
        ...archive,
        sourceUrl: "https://example.com/another-season",
      }),
    ).toBeNull();
    expect(historicalRulebook({ ...archive, links: [] })).toBeNull();
  });
  it("preserves every nonempty line of the provided document in eight sections", () => {
    const normalize = (text: string) =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
    const reconstructed = [
      s9.title,
      ...s9.sections.flatMap((section) => [section.heading, section.body]),
    ].join("\n");
    expect(s9.sections).toHaveLength(8);
    expect(normalize(reconstructed)).toBe(
      normalize(readFileSync("docs/imports/s9-rulebook.txt", "utf8")),
    );
    expect(s9.version).toContain("v1.2");
  });
  it("retains both source illustrations at valid text anchors and their original dimensions", () => {
    const figures = s9.sections.flatMap(
      (section) => ("figures" in section ? section.figures : []) ?? [],
    );
    expect(figures).toHaveLength(2);
    for (const section of s9.sections)
      for (const figure of ("figures" in section ? section.figures : []) ??
        []) {
        expect(section.body).toContain(figure.after);
        const image = readFileSync(`public${figure.src}`);
        expect(image.readUInt32BE(16)).toBe(figure.width);
        expect(image.readUInt32BE(20)).toBe(figure.height);
      }
  });
});
