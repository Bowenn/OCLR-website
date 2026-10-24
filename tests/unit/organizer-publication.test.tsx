import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { english } from "../../src/i18n/translate";
import About from "../../src/app/about/page";
import { publicStaff } from "../../src/lib/public-staff";
vi.mock("../../src/i18n/server", () => ({
  getAppTranslations: async () => english,
}));
vi.mock("../../src/i18n/shared", () => ({ useAppTranslations: () => english }));
vi.mock("../../src/lib/public-staff", () => ({ publicStaff: vi.fn() }));
vi.mock("../../src/lib/auth/config", () => ({ privacyContact: () => null }));
async function render() {
  return new Response(await renderToReadableStream(await About())).text();
}
describe("organizer directory publication", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.mocked(publicStaff).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it.each(["production", "test"])(
    "keeps placeholder identities out of %s",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      const html = await render();
      expect(html).toContain("Public staff profiles have not been announced.");
      for (const name of [
        "Northwind",
        "Komorebi",
        "Yukino",
        "Daybreak",
        "Shiro",
        "Kite",
      ])
        expect(html).not.toContain(`<h4>${name}</h4>`);
    },
  );
  it("renders published people without filling other roles with placeholders", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(publicStaff).mockResolvedValue([
      {
        osuId: 4242,
        username: "Published Pooler",
        countryCode: null,
        roles: [{ role: "mappooler", edition: null }],
      },
    ]);
    const html = await render();
    expect(html).toContain("Published Pooler");
    expect(html).toContain("https://osu.ppy.sh/users/4242");
    expect(html).not.toContain("Northwind");
    expect(html).not.toContain("Kite");
  });
  it("renders published Replayers in their own section", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(publicStaff).mockResolvedValue([
      {
        osuId: 4244,
        username: "Published Replayer",
        countryCode: null,
        roles: [{ role: "replayer", edition: null }],
      },
    ]);
    const html = await render();
    const section = html.match(
      /<section class="organizer-group" id="replayer"[\s\S]*?<\/section>/,
    )?.[0];
    expect(section).toContain("Published Replayer");
    expect(section).toContain("Replayer");
    expect(section).toContain("All editions");
  });
  it("retains the visual sample directory in development only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = await render();
    expect(html).toContain("Northwind");
    expect(html).toContain("Komorebi");
  });
  it("renders an approved Developer in its own section", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(publicStaff).mockResolvedValue([
      {
        osuId: 4243,
        username: "Published Developer",
        countryCode: null,
        roles: [{ role: "developer", edition: null }],
      },
    ]);
    const html = await render();
    const section = html.match(
      /<section id="developer"[\s\S]*?<\/section>/,
    )?.[0];
    expect(section).toContain("Published Developer");
    expect(section).toContain('href="https://osu.ppy.sh/users/4243"');
    expect(section).toContain('src="https://a.ppy.sh/4243"');
    expect(section).toContain("All editions");
    expect(section).not.toContain("Not announced");
    expect(html).not.toContain("Kite");
  });
});
