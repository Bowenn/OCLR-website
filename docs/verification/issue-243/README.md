# Historical hero artwork (#243)

S7–S10 share one contained frame: desktop half the small viewport height capped at 30rem; mobile 40svh capped at 20rem. Images retain their full aspect ratio. Existing configured branding wins over source-based defaults. Organizer visual review remains pending.

## Local verification — 2026-10-25

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
