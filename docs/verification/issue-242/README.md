# Historical match pool links (#242)

S8/S9 source stages and all 20 S10 group matches resolve to their correct pools. S10 MP evidence distinguishes shared versus exclusive beatmaps. S7 LF/GF remain unknown without evidence; see docs/archive-match-pools.md.

## Local verification — 2026-10-25

- Production build, lint/type checks and i18n extraction passed on the combined verification branch. No new interface copy was introduced.
- Combined unit/integration run: 848 passed, 1 skipped. The subsequent S10 MP evidence tests passed separately (7 adapter tests).
- All 22 targeted desktop/mobile checks passed after correcting two stale test assumptions and waiting for bracket geometry; dedicated issue checks passed using installed Google Chrome and the isolated `oclr_thread_ui_test` PostgreSQL database. Screenshots use synthetic configuration and archived competition evidence, not production state.
- Production dependency audit: zero vulnerabilities. No deployment or production data write.
- Remote CI and organizer visual acceptance are separate from these local checks.

## Screenshots

- [desktop-s10-pool-links](desktop-s10-pool-links.png)
- [mobile-s10-pool-links](mobile-s10-pool-links.png)
