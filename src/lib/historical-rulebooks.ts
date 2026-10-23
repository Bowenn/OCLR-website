import s9 from "@/content/s9-rulebook.json";
import s10 from "@/content/s10-rulebook.json";
import type { HistoricalArchive } from "./historical-archive";

const supplements = [
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
            document.pathname === new URL(rules.documentUrl).pathname
          );
        }),
    )?.rules ?? null
  );
}
