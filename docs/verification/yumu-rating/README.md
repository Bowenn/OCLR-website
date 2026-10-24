# YumuRating batch verification — 2026-10-24

| Issue | PR   | Scope                                                                          |
| ----- | ---- | ------------------------------------------------------------------------------ |
| #192  | #218 | Approved fixture MRA/ERA/DRA/RWS; no star weighting                            |
| #193  | #219 | Raw-game round/group aggregation and versioned weekly MRA awards               |
| #194  | #220 | PlayerClass V2, contextual labels, evidence and edition-scoped profile history |

PR order is #218 → #219 → #220. Each issue has its own feature branch/commits; later PRs target the preceding branch. Latest verified main base: `963d8f0784f1b584207e09659938a51f5bf23523`. Migration `0034_yumu_award_policy.sql` follows the existing Streamer, player messages and deferred-registration migrations. No main force push, PR merge or deployment was performed.

## Local evidence

Executed in an isolated Git worktree without `.env.local`, using Node 26.12.0, Next.js 16.4.2 and PostgreSQL 17.11. CI's Node 24/Linux run remains authoritative and is reported separately in each PR; local success does not claim CI success.

- `npm run check`: passed (ESLint, route generation and TypeScript).
- `npm test` with explicit `TEST_DATABASE_URL` pointing to the freshly migrated `oclr_yumu_final_test`: **119 files passed; 858 tests passed, 1 existing skip**.
- `npm run build`: passed, including production compilation and TypeScript.
- `npm audit --omit=dev`: **0 production vulnerabilities**. No dependency manifest/lockfile changed in this batch.
- `npm run i18n:extract` / `npm run test:i18n`: catalogs synchronized; i18n tests included in the passing full suite.
- Fresh migrations and persisted legacy-award upgrade/repeat-migration tests passed. Existing policy/version/weeks and immutable releases remain unchanged by the additive migration.
- Separate `oclr_yumu_browser_test` prevents browser fixtures from racing the integration suite.

Final browser command:

```sh
PLAYWRIGHT_CHANNEL=chrome TEST_DATABASE_URL="$ISOLATED_BROWSER_TEST_URL" \
  npx playwright test tests/e2e/ratings.spec.ts tests/e2e/series-rating.spec.ts \
  tests/e2e/player-class.spec.ts tests/e2e/awards.spec.ts tests/e2e/results.spec.ts
```

**10/10 desktop/mobile tests passed.** The PlayerClass test visits all 36 combinations of locale (`en`, `zh-Hans`, `zh-Hant`), light/dark, default/cute-pastel/swiss-minimal and desktop/emulated iPhone 13. English tables in all 12 appearance/theme/device combinations pass Axe checks, including an open classification on a hovered desktop row. No page-level horizontal overflow; rating tables retain their labeled, keyboard-focusable horizontal scroll regions. Result approval, Admin/public publication, original legacy awards, explicit MRA publication and scoped profile history are covered.

Initial browser launch lacked Playwright's bundled Chromium. The project's supported `PLAYWRIGHT_CHANNEL=chrome` was used with temporary browser profiles; the user's browser profile was not changed. First browser feedback identified low-contrast muted classification text on hovered desktop rows and a legacy test's ambiguous status locator. Both were fixed in their respective issue branches; affected retests and the final combined 10-test run passed.

All data shown is synthetic test-fixture data. The formula and explicit deviations, SR non-adoption rationale, policies and Apache-2.0 provenance are documented in [../../yumu-rating.md](../../yumu-rating.md).

## Visual evidence

The images focus on the rating section after opening a classification. Mobile tables deliberately scroll horizontally; the mobile image shows the classification columns after interaction.

- [Desktop / light / default](desktop-light.png)
- [Desktop / dark / Swiss](desktop-dark-swiss.png)
- [Mobile / dark / pastel](mobile-dark-pastel.png)

## Review boundary

New Chinese policy explanations and upstream-derived classification names are included for organizer review, not claimed to be approved. CI and PR review remain separate gates. Neither policy selection nor a successful test publishes awards or deploys code. Existing organizer-attested deployment/OAuth/rehearsal evidence is not reopened by this batch.
