# Historical MP statistics — S7–S10 (#177)

## Product and calculation

The statistics workspace uses the existing MainSheet appearance tokens: a calm, compact table with small player avatars and one accent for selection. The reading order is coverage → stage tabs → team/search/sort → player aggregates → optional per-game detail. Interaction is confined to tab/filter transitions, row selection and expanding details; no decorative dashboard mosaic or new UI framework.

The existing archive MP inventory contains 111 played matches / 111 links: S7 21, S8 38, S9 22 and S10 30. The S7 confirmed forfeit has no played game and contributes no player statistics. Empty templates are not imported.

- One selected official game is one map appearance, including a recorded failed score. Match appearances count distinct archive fixture IDs.
- Raw total / arithmetic mean score, arithmetic mean known accuracy, maximum recorded combo, complete-known Miss sum and mean known pass flags are shown. Missing fields stay null, never guessed as zero. Accuracy shows known-value coverage.
- Relative score = player score / highest player score **in the same game**, averaged over known positive-denominator games. This is a descriptive metric, not a retroactive award release or a new eligibility/Tier rule.
- All-zero games have no relative score. Zero observed appearances are displayed as unknown when match coverage is incomplete. Raw score systems remain literal in per-game detail; cross-system totals and small samples require care.
- Stage labels, identities, map metadata, timestamps and mod values remain source literals. Stage grouping uses existing archive fixture stages; it does not fabricate weekly dates or unrecorded knockout round names.

Public: `/tournaments/s7/statistics` through `s10`. Admin: `/admin/tournaments/{edition}/statistics`.

## Import and review

The server follows only MP IDs already present in that edition's authoritative historical archive. It reuses `fetchMatchSource` and the credential-isolated official osu! API client, including ascending pagination, event bounds, duplicate/change detection, size/time budgets, rate limiting and failure preservation. Arbitrary URLs and client-supplied scores cannot be imported.

Import missing histories sequentially; stop after the current MP or resume later. A failed/deleted/rate-limited source leaves saved draft and published data intact. One source is bounded to 500 games / 2 MB. No visitor request fetches provider data.

Imports produce **private drafts with no selected games**. Reviewers choose the recorded pool and scoring games, excluding warmups, aborted games and superseded replays. Incomplete/unfinished histories, unsupported modes/scoring, missing/conflicting score facts, unknown/opponent roster identities, ambiguous team colors and duplicate/replayed maps cannot be approved. Both team identities are attributed by UID, never by lobby title or name similarity.

Missing historical pools (notably S7's empty GF source) do not justify inventing maps. A reviewer may explicitly confirm that the pool is incomplete and select authoritative MP beatmaps instead. This confirmation is saved with the review/audit. Such games retain MP beatmap metadata and an unknown pool slot. Roster, source completeness, duplicate checks and score reconciliation still apply.

An edition Admin explicitly **Approve & publish statistics** for a whole fixture. Every recorded MP source must be imported; selected map totals and team wins must exactly reconcile with the already accepted historical series score. This detects most extra warmup/replay mistakes but does not replace human review. Withdraw hides only that fixture's statistical release. The archive result is never edited by statistics operations, and the edition need not go offline.

## Storage and permissions

Migration `0029_historical_statistics.sql` adds `historical_statistics`, keyed by edition + MP ID, with independent draft, published snapshot and optimistic version. Writes lock the authoritative edition row, recheck permission and archive fingerprint, and append an automatic `edition_events` record transactionally. Concurrent stale operations fail 409. An unchanged source refresh preserves review choices and adds no duplicate release/audit.

Referees may import/review only their edition; Admin approval is required for publication/withdrawal. Public reads require a published S7–S10 historical edition and expose only selected released games with minimal existing roster identities. Provider event logs, draft selections and audit details remain private. Refreshed/edited drafts never silently replace a published snapshot.

The archive fingerprint covers competition identities, matches and pool evidence. Competition changes invalidate dependent statistics; staff-only/provenance edits do not. Duplicate game claims across published fixtures are rejected. No accounts, registrations, roles or live result records are created.

## Deployment handoff

1. Organizer deploys the reviewed commit using the existing backed-up migration/release workflow. This feature requires migration 0029; do not roll back to a build that lacks this table while serving these routes.
2. Through computer use, open each S7–S10 statistics manager and import missing MP histories. Existing edition visibility stays unchanged.
3. Review official games against pool/roster/series score. Leave unavailable sources uncovered; retain original series results.
4. Approve and publish each reviewed fixture separately. Verify anonymous coverage, stage/team/player filters, score details, desktop/mobile and both themes.
5. Record actual production evidence on #177. Local synthetic verification does not establish availability of these 111 historical MP histories.

Do not read local OAuth secrets or call the production database/API from development. Existing server-side osu! public credentials are used at runtime. No production deployment/import is performed by this development step.

## Local verification (2026-10-24)

- Full unit/integration batch: 99 files, 727 passed, one existing skipped test, using only `oclr_archive_test`.
- After final statistics refinements: all 26 affected model, MP-normalization, i18n and transaction checks passed; lint/types and production build passed. Production dependency audit: zero vulnerabilities.
- Desktop and mobile Chrome browser workflows passed: real importer/review UI, warmup/replay blocking, explicit publication, anonymous/private API boundary, all four editions, all three appearances, light/dark, search, per-game hit counts and both Chinese locales. Axe reports no violations and document widths remain within 1440/390 px.
- Browser testing found and corrected select-label ambiguity and filled-button theme inheritance that reduced role-text contrast. Rendered desktop dark and mobile Swiss light screenshots were visually inspected.
- Migration 0029 was applied only to the isolated local test database. No production MP availability, live import, deployment or published historical statistics are claimed here; these remain deployment-time acceptance work.
