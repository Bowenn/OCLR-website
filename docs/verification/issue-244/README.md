# S8 staff supplement (#244)

Recorded match roles supplement the S8 staff view without mutating the archive or granting live permissions. Names stay literal; unknown osu! IDs remain unlinked. Source ranges are retained in the derived data.

## Local verification — 2026-10-25

- Production build, lint/type checks and i18n extraction passed on the combined verification branch. No new interface copy was introduced.
- Combined unit/integration run: 848 passed, 1 skipped. The subsequent S10 MP evidence tests passed separately (7 adapter tests).
- All 22 targeted desktop/mobile checks passed after correcting two stale test assumptions and waiting for bracket geometry; dedicated issue checks passed using installed Google Chrome and the isolated `oclr_thread_ui_test` PostgreSQL database. Screenshots use synthetic configuration and archived competition evidence, not production state.
- Production dependency audit: zero vulnerabilities. No deployment or production data write.
- Remote CI and organizer visual acceptance are separate from these local checks.

## Screenshots

- [desktop-s8-staff](desktop-s8-staff.png)
- [mobile-s8-staff](mobile-s8-staff.png)
