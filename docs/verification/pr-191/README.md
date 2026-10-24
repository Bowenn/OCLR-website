# PR #191 public-data review fixes — 2026-10-24

## Verified behavior

- The homepage uses the featured edition's registration availability and configured dates/time zone. Closed, paused, upcoming, unavailable and unannounced registration do not advertise an active enrollment link; no current edition displays the existing announcement-pending message.
- Static organizer placeholders render only with `NODE_ENV=development`. Production renders published staff identities and the existing unannounced state for empty roles/directories.
- Statistics group maps by round, slot and stable beatmap ID (literal title only when no ID exists). Map filters and both placement views use the same identities. Pick-rate denominators retain all scored fixtures in the relevant round when a map is selected.
- Schedule cards and table rows retain and label cancelled fixtures. Group standings reuse the existing `GroupStandings` component and the server's published group data, including pending rankings, configured points/tiebreakers, equal ranks and edition-scoped team links.

Current main was merged into the PR branch before final verification, retaining #190's bulk-registration changes and the updated UI skill guidance. No new interface wording or translation catalog entries were introduced; the PR's existing new Chinese content still needs its separate organizer review. #181's staff-management feature is not implemented by these fixes.

## Local verification

All database fixtures used the disposable loopback-only PostgreSQL database **`oclr_pr191_fix_test`**, on port **55490**. No demo/production database, live provider enrollment or deployment was used.

```sh
npm run i18n:extract
npm run check
TEST_DATABASE_URL=postgresql://oclr_review@127.0.0.1:55490/oclr_pr191_fix_test npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
TEST_DATABASE_URL=postgresql://oclr_review@127.0.0.1:55490/oclr_pr191_fix_test \
  PLAYWRIGHT_CHANNEL=chrome npx playwright test \
  tests/e2e/public-review-regressions.spec.ts \
  tests/e2e/public-staff.spec.ts tests/e2e/header-actions.spec.ts
npm audit --omit=dev --registry=https://registry.npmjs.org
```

- Lint, generated route types, TypeScript, catalog extraction/localization checks and the normal Turbopack production build passed.
- Full unit/integration suite after merging current main: **107 files passed; 796 tests passed, 1 existing skip**. After the final statistics denominator refinement, the affected model/localization checks (**6 tests**), affected-file lint and production build passed again.
- All **10** affected desktop/mobile browser scenarios passed across the combined run and the final statistics rerun. The first run's two statistics failures came from an overly exact dropdown-label locator; the accessible combobox locator and both final interaction scenarios passed.
- Coverage includes three appearances and both themes for the homepage/empty organizer directory, Simplified/Traditional Chinese rendering checks, navigation/menu widths, explicit staff publication, cancellation indicators, unpublished group standings, cross-round map identities, filters, team/solo placement columns, and a selected map retaining its **50%** round-wide pick rate.
- Axe WCAG A/AA checks and page-overflow assertions passed. Mobile homepage, cancellation/schedule and statistics screenshots were visually inspected; browser artifacts are generated under ignored `test-results/`.
- Production dependency audit: **0 vulnerabilities**.

The full E2E suite was not rerun locally. GitHub CI for the pushed revision remains authoritative and is reported separately; no pending CI run is claimed as passed.
