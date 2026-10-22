import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { english } from "../../src/i18n/translate";
import { edition } from "../fixtures/edition";
import Overview from "../../src/app/tournaments/[edition]/page";
import { getPublicEdition } from "../../src/lib/content";
import { publicCompetition } from "../../src/lib/public-competition";
import { publicMappools } from "../../src/lib/mappools";
import { publishedTeams } from "../../src/lib/teams";
import { publicParticipantCount } from "../../src/lib/players";
vi.mock("../../src/i18n/server", () => ({
  getAppTranslations: async () => english,
}));
vi.mock("../../src/lib/content", () => ({ getPublicEdition: vi.fn() }));
vi.mock("../../src/lib/registrations", () => ({
  registrationAvailability: async () => "unavailable",
}));
vi.mock("../../src/lib/public-competition", () => ({
  publicCompetition: vi.fn(),
}));
vi.mock("../../src/lib/mappools", () => ({ publicMappools: vi.fn() }));
vi.mock("../../src/lib/teams", () => ({ publishedTeams: vi.fn() }));
vi.mock("../../src/lib/players", () => ({ publicParticipantCount: vi.fn() }));
// The server composition test isolates client timer behavior (covered by browser tests).
vi.mock("../../src/components/season-countdown", () => ({
  SeasonCountdown: () => null,
}));
describe("overview partial data failures", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.mocked(getPublicEdition).mockResolvedValue(edition);
    vi.mocked(publicCompetition).mockResolvedValue({
      fixtures: [],
      groups: [],
      databaseAuthority: true,
    });
    vi.mocked(publicMappools).mockResolvedValue([]);
    vi.mocked(publishedTeams).mockResolvedValue([]);
    vi.mocked(publicParticipantCount).mockResolvedValue(0);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });
  const render = async () =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        {await Overview({ params: Promise.resolve({ edition: edition.slug }) })}
      </NextIntlClientProvider>,
    );
  it.each([
    publicCompetition,
    publicMappools,
    publishedTeams,
    publicParticipantCount,
  ])(
    "keeps configured dates and disclosure available when a secondary query fails",
    async (query) => {
      vi.mocked(query).mockRejectedValue(new Error("PRIVATE_DATABASE_DETAILS"));
      const html = await render();
      expect(html).toContain(
        "Some competition information is temporarily unavailable",
      );
      expect(html).toContain(edition.registration!.opensAt);
      expect(html).toContain(edition.eligibility!);
      expect(html).not.toContain("PRIVATE_DATABASE_DETAILS");
      expect(html).not.toContain('class="event-overview-main"');
      if (query === publicParticipantCount)
        expect(html).not.toContain('class="season-player-count"');
    },
  );
});
