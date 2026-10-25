import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import {
  historicalRulebook,
  historicalRulebookSeason,
} from "../../src/lib/historical-rulebooks";
import s9 from "../../src/content/s9-rulebook.json";
import s5 from "../../docs/imports/s5-rulebook.json";

const archive = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
);
describe("S5 versioned historical rules", () => {
  const s5Archive = historicalArchiveSchema.parse(
    JSON.parse(readFileSync("docs/imports/s5-reviewed-import.json", "utf8")),
  );
  const configured = { version: s5.version, sections: s5.sections };

  it("reads the saved sections only for the evidenced workbook and rulebook pair", () => {
    const rules = historicalRulebook(s5Archive, configured);
    expect(rules).toEqual(s5);
    expect(historicalRulebookSeason(rules!)).toBe("5");
    expect(
      historicalRulebook(
        { ...s5Archive, editionSlug: "renamed-copy" },
        configured,
      ),
    ).toEqual(s5);
    expect(historicalRulebook(s5Archive)).toBeNull();
    expect(
      historicalRulebook({ ...s5Archive, links: [] }, configured),
    ).toBeNull();
    expect(
      historicalRulebook(
        { ...s5Archive, sourceUrl: archive.sourceUrl },
        configured,
      ),
    ).toBeNull();
  });

  it("uses later saved versions without replacing the literal source content", () => {
    const updated = {
      version: "organizer-revision",
      sections: s5.sections.slice(1),
    };
    expect(historicalRulebook(s5Archive, updated)).toMatchObject(updated);
  });

  it("preserves the source's nonempty lines in its original section order", () => {
    const normalize = (text: string) =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
    expect(
      normalize(
        [s5.title, ...s5.sections.flatMap((s) => [s.heading, s.body])].join(
          "\n",
        ),
      ),
    ).toBe(normalize(readFileSync("docs/imports/s5-rulebook.txt", "utf8")));
  });
});
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
