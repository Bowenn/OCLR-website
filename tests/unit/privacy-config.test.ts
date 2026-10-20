import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Privacy from "../../src/app/privacy/page";
import {
  authReady,
  oauthConfig,
  privacyContact,
  privacyReady,
} from "../../src/lib/auth/config";

describe("explicit osu! privacy contact", () => {
  beforeEach(() => {
    // Vitest renders this server page without the Next.js JSX compiler.
    vi.stubGlobal("React", React);
    vi.stubEnv("APP_URL", "https://oclr.example.test");
    vi.stubEnv("DATABASE_URL", "postgres://synthetic-test-only");
    vi.stubEnv("OSU_CLIENT_ID", "123");
    vi.stubEnv("OSU_CLIENT_SECRET", "PRIVATE_SYNTHETIC_CREDENTIAL");
    vi.stubEnv("ADMIN_OSU_IDS", "70001,80001");
    vi.stubEnv("PRIVACY_CONTACT_OSU_ID", "60001");
    vi.stubEnv(
      "PRIVACY_RETENTION_NOTICE",
      "Synthetic approved retention policy.",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const html = () => renderToStaticMarkup(React.createElement(Privacy));
  it("enables configured OAuth and publishes exactly one designated contact without exposing other admins", () => {
    expect(privacyReady()).toBe(true);
    expect(authReady()).toBe(true);
    expect(oauthConfig().redirectUri).toBe(
      "https://oclr.example.test/auth/osu/callback",
    );
    const page = html();
    expect(
      page.match(/href="https:\/\/osu.ppy.sh\/users\/60001"/g),
    ).toHaveLength(1);
    expect(page).toContain("Contact OCLR Admin on osu!");
    for (const privateValue of [
      "mailto:",
      "70001",
      "80001",
      "PRIVATE_SYNTHETIC_CREDENTIAL",
    ])
      expect(page).not.toContain(privateValue);
  });
  it.each([
    undefined,
    "",
    " ",
    "0",
    "-1",
    "+1",
    "001",
    "1.2",
    "1e3",
    "60001,70001",
    "https://osu.ppy.sh/users/60001",
    "9007199254740992",
    "<script>",
  ])("fails closed for invalid or missing explicit ID %s", (value) => {
    vi.stubEnv("PRIVACY_CONTACT_OSU_ID", value);
    expect(privacyContact()).toBeNull();
    expect(privacyReady()).toBe(false);
    expect(authReady()).toBe(false);
    expect(() => oauthConfig()).toThrow(/not configured/);
    const page = html();
    expect(page).toContain("awaiting");
    expect(page).not.toContain("https://osu.ppy.sh/users/");
    expect(page).not.toContain("mailto:");
  });
  it.each(["", " \n "])("requires actual retention text %s", (notice) => {
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", notice);
    expect(privacyReady()).toBe(false);
    expect(authReady()).toBe(false);
    expect(html()).not.toContain('href="https://osu.ppy.sh/users/');
  });
  it("hides email addresses in public policy text without changing stored retention terms", () => {
    const notice =
      "Synthetic approved policy context: archive@example.test <retention>";
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", notice);
    const page = html();
    expect(page).toContain("the designated osu! contact &lt;retention&gt;");
    expect(page).not.toContain("archive@example.test");
    expect(process.env.PRIVACY_RETENTION_NOTICE).toBe(notice);
    expect(page).not.toContain("mailto:");
  });
  it("removes multiple email contacts and mailto prefixes while retaining policy dates", () => {
    vi.stubEnv(
      "PRIVACY_RETENTION_NOTICE",
      "Keep applications for 30 days. Contact: mailto:first+privacy@example.test or SECOND@EXAMPLE.ORG.",
    );
    const page = html();
    expect(page).toContain("Keep applications for 30 days.");
    expect(page).not.toMatch(/mailto:|first\+privacy@|SECOND@/);
    expect(
      page.match(/href="https:\/\/osu.ppy.sh\/users\/60001"/g),
    ).toHaveLength(1);
  });
  it("accepts a single trimmed safe numeric ID and does not grant staff access", () => {
    vi.stubEnv("PRIVACY_CONTACT_OSU_ID", ` ${Number.MAX_SAFE_INTEGER} `);
    expect(privacyContact()?.url).toBe(
      `https://osu.ppy.sh/users/${Number.MAX_SAFE_INTEGER}`,
    );
    expect(process.env.ADMIN_OSU_IDS).toBe("70001,80001");
  });
});
