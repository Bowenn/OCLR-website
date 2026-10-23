import s9 from "@/content/s9-rulebook.json";
import type { HistoricalArchive } from "./historical-archive";

/** Organizer-provided supplement for the existing S9 import; never a live-rules fallback. */
export function historicalRulebook(archive: HistoricalArchive) {
  const sheet = new URL(archive.sourceUrl);
  const isS9 =
    sheet.hostname === "docs.google.com" &&
    sheet.pathname ===
      "/spreadsheets/d/11PwNlEsUFb6f3VCY2-sdGlPysP0ukihN8_lE4DGuzfA/edit" &&
    archive.links.some(({ url }) => {
      const document = new URL(url);
      return (
        document.hostname === "docs.google.com" &&
        document.pathname === new URL(s9.documentUrl).pathname
      );
    });
  return isS9 ? s9 : null;
}
