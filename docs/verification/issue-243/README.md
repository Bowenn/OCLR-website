# Historical hero artwork (#243)

S7–S10 share an equal-width desktop split: the uncropped key visual sits on the left, aligned to the left edge, and archival counts fill the right half in a two-column grid. At 760px and below the image and counts stack vertically. The common image frame remains capped at half the small viewport height / 30rem on desktop and 40svh / 20rem on mobile. Existing configured branding wins over source-based defaults. This implements the organizer’s PR #251 layout clarification; visual review remains pending.

## Left/right layout follow-up — 2026-10-25

The organizer requested artwork on the left and archival data on the right in PR #251. The updated screenshots below replace the earlier centered-art proposal. Verified with lint/type checks, production build, four artwork-selection unit tests and two desktop/mobile browser tests (four seasons × two themes × three appearances on each device). Browser assertions check equal desktop column widths, left/right ordering, mobile stacking, exact archive counts, consistent image-frame heights and no horizontal overflow. No new interface text or data changes.

## Initial batch verification — 2026-10-25

- Production build, lint/type checks and i18n extraction passed on the combined verification branch. No new interface copy was introduced.
- Combined unit/integration run: 848 passed, 1 skipped. The subsequent S10 MP evidence tests passed separately (7 adapter tests).
- All 22 targeted desktop/mobile checks passed after correcting two stale test assumptions and waiting for bracket geometry; dedicated issue checks passed using installed Google Chrome and the isolated `oclr_thread_ui_test` PostgreSQL database. Screenshots use synthetic configuration and archived competition evidence, not production state.
- Production dependency audit: zero vulnerabilities. No deployment or production data write.
- Remote CI and organizer visual acceptance are separate from these local checks.

## Screenshots

- [desktop-s10-before](desktop-s10-before.png)
- [desktop-s10-dark](desktop-s10-dark.png)
- [desktop-s7-before](desktop-s7-before.png)
- [desktop-s7-dark](desktop-s7-dark.png)
- [desktop-s8-before](desktop-s8-before.png)
- [desktop-s8-dark](desktop-s8-dark.png)
- [desktop-s9-before](desktop-s9-before.png)
- [desktop-s9-dark](desktop-s9-dark.png)
- [mobile-s10-before](mobile-s10-before.png)
- [mobile-s10-dark](mobile-s10-dark.png)
- [mobile-s7-before](mobile-s7-before.png)
- [mobile-s7-dark](mobile-s7-dark.png)
- [mobile-s8-before](mobile-s8-before.png)
- [mobile-s8-dark](mobile-s8-dark.png)
- [mobile-s9-before](mobile-s9-before.png)
- [mobile-s9-dark](mobile-s9-dark.png)
