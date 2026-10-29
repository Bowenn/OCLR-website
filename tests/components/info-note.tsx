import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { InfoNote } from "../../src/components/info-note";
import { PageNotes } from "../../src/components/page-notes";
import en from "../../messages/en.json";
import "../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <main style={{ padding: 24 }}>
      <h1>Notes interaction</h1>
      <InfoNote>
        <p>Supplementary explanation</p>
        <a href="#target">Reference</a>
      </InfoNote>
      <p role="status">Review pending</p>
      <PageNotes>
        <p>Coverage details</p>
      </PageNotes>
      <button id="target">Outside</button>
    </main>
  </NextIntlClientProvider>,
);
