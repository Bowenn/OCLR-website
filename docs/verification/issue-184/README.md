# Issue #184: username lookup and bulk assisted enrollment

Verified locally on 2026-10-24, from `origin/main` at `16f187a`, in an isolated worktree. All identities and competition data in these screenshots/tests are synthetic. The user's demo server/database, OAuth configuration and real tournament registrations were not used or modified.

## Behavior and bounds

- Existing single entry supports explicitly typed current usernames as well as IDs/profile URLs. Numeric usernames are never guessed as IDs. Preview shows current name/avatar/stable ID/profile link and existing registration links.
- Bulk paste supports 20 non-empty lines / 8192 characters, ignores blanks, keeps spaces/source lines, and supports explicit `name:` / `id:` prefixes plus canonical profile URLs.
- Username lookup uses the official `@` syntax; returned current names must match case-insensitively. Old-name fallback is deliberately rejected. Stable IDs govern confirmation, de-duplication and persistence. Provider failures and stale cache fallbacks never become unverified identities.
- Preview writes no registrations. Existing records of all four statuses remain intact. Selection, initial status, public identity approval, per-player eligibility exceptions and window explanations are explicit.
- Each selected player commits through the existing enrollment service and atomic identity/registration/event transaction. Individual failures are reported alongside successful commits. Retrying after a lost response skips existing records; retry preview retains completed rows and refreshes only unfinished rows.
- JSON stream: 32 KiB. Sequential provider calls reuse the existing pacer, bounded attempts/timeouts and shared ID cache/backoff; username resolution adds a bounded 60-second cache and 8-request cap. See the [operator guide](../../tournament-management.md#bulk-staff-assisted-enrollment-184).

## Validation

Commands use a new disposable PostgreSQL cluster on loopback port 55484 with database **`oclr_issue_184_test`**. No demo/production fixtures are run. Migrations were applied to this empty test database only. `PATH` includes the locally installed PostgreSQL 17 client tools for deployment/backup tests.

```sh
npm run check
npm run i18n:extract
npm run test:i18n
TEST_DATABASE_URL=postgresql://me@127.0.0.1:55484/oclr_issue_184_test npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
TEST_DATABASE_URL=postgresql://me@127.0.0.1:55484/oclr_issue_184_test \
  PLAYWRIGHT_CHANNEL=chrome npx playwright test \
  tests/e2e/manual-registration.spec.ts tests/e2e/bulk-manual-registration.spec.ts
npm audit --omit=dev --registry=https://registry.npmjs.org
```

Checks performed:

- Lint, TypeScript, catalog extraction, all localization checks and production build passed. Production dependency audit: zero vulnerabilities.
- Full unit/integration suite: **100 files passed; 751 tests passed, 1 existing skip**.
- Extended manual-registration integration suite: 23 passed. Coverage includes explicit numeric-name disambiguation, case/spaces/brackets, old names, preview-only identity resolution, mixed-source duplicates, all existing statuses, 20-player concurrent/retried batches, audit-write rollback per player, version changes, publication/window/per-player eligibility confirmations, role revocation during a batch, rate limits/timeouts/restricted profiles, and request bounds. The existing tests retain completed/locked/frozen editions, scoped authorization and public/private provenance boundaries.
- All 8 affected desktop/mobile browser scenarios passed (the six workflow cases in the combined run, plus both final matrix reruns).
- Desktop/mobile browser scenarios verify single-entry regression, selection/exclusion/editing, default Pending and Accepted publication approval, committed-but-lost responses, accurate skip/retry counts, real transaction partial failure and retry, body limits and existing-record links.
- Matrix: default/cute-pastel/swiss-minimal × light/dark × en/zh-Hans/zh-Hant × 1440px/390px. Every combination checks rendered preference attributes, long input/errors, identity rows, no horizontal overflow, Axe WCAG A/AA checks, Escape dismissal and restored trigger focus. Confirmation controls remain reachable in the dialog's scroll area. Existing single-entry checks also cover 320px/768px widths.

The first full-suite run exposed a local `pg_dump` PATH mismatch; the deployment test passed with the PostgreSQL 17 client directory on PATH. The first cold-cache desktop preview exceeded Playwright's default 5-second assertion wait; its bounded wait is now 45 seconds to accommodate the real sequential provider pacer. The affected desktop matrix passed after that test adjustment.

## PR #190 rename-cache follow-up (2026-10-24)

A current-username lookup can resolve successfully while the shared 30-minute ID cache still contains the player's former name. The lookup now refreshes that ID snapshot before rejecting a name mismatch. Refresh claims, provider backoff and unavailable-profile checks remain enforced; a refreshed official identity that still differs is rejected.

Five added integration cases cover single/batch previews after a rename, transient refresh failure and retry backoff, an active refresh cooldown, and a genuine mismatch after refresh. Successful previews persist the refreshed cache without creating users, registrations or events.

Verification used the isolated **`oclr_pr190_review_test`** database in a disposable loopback-only PostgreSQL cluster on port 55490. `npm run check`, the full unit/integration suite (**100 files, 756 passed, 1 existing skip**), production build, all **8** affected desktop/mobile Playwright scenarios and the production dependency audit (**0 vulnerabilities**) passed. The first sandboxed build stalled during compilation and was stopped; the normal build passed outside that sandbox. No interface messages changed. No live provider enrollment or deployment was performed; CI and organizer wording review remain separate gates.

A concurrent PR update added another profile-cache regression test. After incorporating that update, the registration and profile-cache integration suites passed again (**38 tests**), as did lint for the affected TypeScript files. The verified application code is unchanged by that integration. Failed refreshes retain their unavailable result instead of substituting the earlier username response; a genuine mismatch after a successful refresh still returns a conflict.

## Screenshots

Baseline single-entry UI: [existing #165 local desktop evidence](../issue-165/after-local-desktop.png). That baseline is an earlier committed verification image, not a new capture of this branch's parent.

| Appearance    | Desktop preview                                                                          | Mobile preview                                                                         |
| ------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Default       | [1440px](desktop-default.png)                                                            | [390px](mobile-default.png)                                                            |
| Cute pastel   | [1440px](desktop-cute-pastel.png)                                                        | [390px](mobile-cute-pastel.png)                                                        |
| Swiss minimal | [Preview](desktop-swiss-minimal.png) / [Confirm](desktop-swiss-minimal-confirmation.png) | [Preview](mobile-swiss-minimal.png) / [Confirm](mobile-swiss-minimal-confirmation.png) |

These captures show the top of the scrollable preview. Confirmation-area captures show the end of the same list and the selected count/status/save controls.

## Review boundaries

Provider HTTP is synthetic in automated tests; no live credentialed osu! lookup, real enrollment or site deployment was performed. The official API behavior was checked against its current [Get User documentation](https://osu.ppy.sh/docs/index.html#get-user). New Simplified/Traditional Chinese wording is submitted for organizer review with this PR; no new wording approval is claimed. CI status is reported separately by GitHub.
