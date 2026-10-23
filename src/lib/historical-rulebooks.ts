import s9 from "@/content/s9-rulebook.json";
import s10 from "@/content/s10-rulebook.json";
import s8 from "@/content/s8-rulebook.json";
import type { HistoricalArchive } from "./historical-archive";

type HistoricalRulebook = {
  title: string;
  version: string | null;
  documentUrl: string;
  cover?: typeof s8.cover;
  sections: {
    heading: string;
    body: string;
    figures?: (typeof s8.cover & { after: string })[];
  }[];
};

const supplements: { sheetId: string; rules: HistoricalRulebook }[] = [
  { sheetId: "16ASDCD95p3TgfjgSHCjXmRN3KJuuAD4KS0fImpcTiiM", rules: s8 },
  { sheetId: "11PwNlEsUFb6f3VCY2-sdGlPysP0ukihN8_lE4DGuzfA", rules: s9 },
  { sheetId: "12BGS8WRnl10OdeUKyvmOypFzpTYCpHgx9QY1mw-0hlw", rules: s10 },
];

/** Organizer-provided source pairs; never fall back to another season's live rules. */
export function historicalRulebook(archive: HistoricalArchive) {
  const sheet = new URL(archive.sourceUrl);
  return (
    supplements.find(
      ({ sheetId, rules }) =>
        sheet.hostname === "docs.google.com" &&
        sheet.pathname === `/spreadsheets/d/${sheetId}/edit` &&
        archive.links.some(({ url }) => {
          const document = new URL(url);
          return (
            document.hostname === "docs.google.com" &&
            document.pathname.replace(/^\/document\/u\/\d+\//, "/document/") ===
              new URL(rules.documentUrl).pathname
          );
        }),
    )?.rules ?? null
  );
}
