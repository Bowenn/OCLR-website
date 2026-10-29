import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { ArchiveCompetition } from "../../src/components/archive-competition";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import saved from "../../docs/imports/s5-archive.json";
import source from "../../docs/imports/s5-source-records.json";
import en from "../../messages/en.json";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";
import "../../src/app/workspace.css";
const archive = historicalArchiveSchema.parse({
  ...saved,
  matches: saved.matches.map((m) => ({
    ...m,
    score: source.matches.find((s) => s.id.toLowerCase() === m.id)!.score,
  })),
});
createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <div className="themed-site public-tournament">
      <ArchiveCompetition
        bracket={archiveBracket(archive, (id) => `/matches/${id}`)}
        teamUrls={{}}
      />
    </div>
  </NextIntlClientProvider>,
);
