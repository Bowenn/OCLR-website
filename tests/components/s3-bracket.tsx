import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { ArchiveCompetition } from "../../src/components/archive-competition";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { s3BracketFixture } from "../fixtures/s3-bracket";
import en from "../../messages/en.json";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";
import "../../src/app/workspace.css";
const archive = s3BracketFixture();
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
