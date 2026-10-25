# Unused blank draft deletion (#327)

Organizer request, 2026-10-26 (Asia/Taipei): add safe deletion of unused blank
tournament drafts, test and push the implementation, then remove the named
accidental draft through the Admin UI after deployment.

## Behavior

- Global Admin only, browser session and same-origin request. Developer read
  channels and remote mode are rejected before any database/remote read.
- Settings → Publication offers **Delete unused draft** for a currently blank
  upcoming draft. The dialog identifies its name/slug and requires typing that
  exact slug. Cancel does not write. Server errors remain visible after refresh.
- The server locks against staff grants and edition/setup writes, checks the
  expected revision, requires a complete sequence of blank saved configurations,
  and rejects all recorded operational use, including revoked staff roles and
  non-configuration audit history. Identity-only corrections remain allowed.
- The active configuration is retired transactionally with its automatic audit
  event. Slug, revisions and prior events remain; no records cascade away.
  Existing readers exclude the retired draft; stale operational writers fail.
- No database migration, provider refresh, role change or deployment is needed
  as part of the implementation itself. The deployed application must include
  this commit before the new action is available.

## Local validation

Node.js 24.22.1, npm ci using the existing lockfile. PostgreSQL 17.11 in a new
loopback-only cluster on port 55487. Separate `oclr_327_test` and
`oclr_327_e2e_test` databases received the existing migrations. No preview or
production database, account credentials or private records were used.

- `npm run check`: passed (ESLint, route type generation, TypeScript).
- `npm test`: 148 files passed; 1,069 tests passed, one existing skip. After the
  final history-completeness and operational-race checks, the four affected
  integration files passed all 79 tests (including 34 draft-deletion cases).
- `npm run build`: passed for the final application source.
- `npm run i18n:extract` / `npm run test:i18n`: passed, four localization checks.
- `npm audit --omit=dev`: zero vulnerabilities.
- Focused desktop/mobile E2E: eight passed. Includes English, Simplified and
  Traditional Chinese, light/dark, 320px mobile, automated WCAG checks, cancel,
  exact slug confirmation, same-origin/session enforcement, scoped Admin denial,
  stale revision rejection, post-deletion reads, repeated deletion and slug reuse.
  Playwright Chromium was installed after the first launch attempt reported a
  missing browser; the eight successful cases ran after installation.
- Full desktop/mobile E2E: desktop completed with 287 passed and two browser
  launch failures (Firefox cannot find its temporary profile; WebKit was not yet
  installed). WebKit has now been installed; the affected case will be rerun.
  The full mobile run is continuing. These are not a full-suite pass or acceptance.
- Remote read coverage inventory: 137 rows checked, no inventory change required
  for the new mutation-only route. Formatting and `git diff --check` checked.

[Desktop confirmation, Traditional Chinese / dark](delete-draft-desktop-dark.png)

## Deployment and production cleanup

Implementation/test evidence is separate from CI, deployment and production
cleanup. New Chinese interface wording awaits organizer review. No production
draft has been deleted by this implementation. After the organizer deploys the
reviewed commit, verify the release and use the existing authenticated Admin UI
to inspect and remove only `oclr-s5s5` (誤建空白草稿（未使用）). Re-read the
list and the retired route afterwards. Do not remove a real Season 5 edition or
alter its rules as part of this cleanup.
