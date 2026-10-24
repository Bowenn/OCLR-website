# Historical group and knockout views (#241)

Group Stage and Knockout are separate top-level views. Existing recorded-appearance connectors show the full knockout timeline; they do not assert unverified qualification rules. See docs/historical-bracket-display.md.

## Local verification — 2026-10-25

- Production build, lint/type checks and i18n extraction passed on the combined verification branch. No new interface copy was introduced.
- Combined unit/integration run: 848 passed, 1 skipped. The subsequent S10 MP evidence tests passed separately (7 adapter tests).
- All 22 targeted desktop/mobile checks passed after correcting two stale test assumptions and waiting for bracket geometry; dedicated issue checks passed using installed Google Chrome and the isolated `oclr_thread_ui_test` PostgreSQL database. Screenshots use synthetic configuration and archived competition evidence, not production state.
- Production dependency audit: zero vulnerabilities. No deployment or production data write.
- Remote CI and organizer visual acceptance are separate from these local checks.

## Screenshots

- [desktop-s10-bracket-after](desktop-s10-bracket-after.png)
- [desktop-s10-schedule-before](desktop-s10-schedule-before.png)
- [desktop-s7-bracket-after](desktop-s7-bracket-after.png)
- [desktop-s8-bracket-after](desktop-s8-bracket-after.png)
- [desktop-s9-bracket-after](desktop-s9-bracket-after.png)
- [mobile-s10-bracket-after](mobile-s10-bracket-after.png)
- [mobile-s10-schedule-before](mobile-s10-schedule-before.png)
- [mobile-s7-bracket-after](mobile-s7-bracket-after.png)
- [mobile-s8-bracket-after](mobile-s8-bracket-after.png)
- [mobile-s9-bracket-after](mobile-s9-bracket-after.png)
