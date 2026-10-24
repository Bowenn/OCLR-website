# YumuRating main integration — 2026-10-25

PR #219 was merged into `codex/192-match-rating` after #218 had already merged to main. PR #220 was subsequently merged into `codex/193-series-rating`. Consequently their merged status did not put the series/awards or PlayerClass implementations into main.

This integration merges the complete original merge commit `c91568d49836c5935467372fa02b05d0810b29e0` into main base `b427e2f4fb0ae44c971ece00f6f56069facd95ab`. It preserves the original separate #193/#194 commits and adds no new rating rules. The only source merge conflicts were concurrent catalog additions; both sides were retained and catalogs re-extracted.

Included functionality:

- Stage/round/group raw-game SeriesRating aggregation and provisional coverage.
- Explicit, versioned MRA award policy, immutable legacy releases and incomplete-week publication checks.
- PlayerClass V2 evaluations, evidence, localized labels and edition-scoped player history.
- Additive `0034_yumu_award_policy.sql`, correctly following main's existing `0033_registration_deferred.sql`.

Single-fixture SR weighting remains forbidden; optional series weighting remains unadopted as documented in [../../yumu-rating.md](../../yumu-rating.md). Existing authorization, draft Tier/Captain rules and publication boundaries are retained.

## Verification

Performed in the isolated worktree without `.env.local`, with Node 26.12.0, Next.js 16.4.2 and PostgreSQL 17.11:

- `npm run check`: passed (lint, route types, TypeScript).
- `npm run i18n:extract` and catalog tests: passed.
- Full `npm test`: **119 files passed; 861 tests passed, 1 existing skip**.
- `npm run build`: passed.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Fresh migrations passed on `oclr_yumu_integration_test` and `oclr_yumu_integration_browser_test`; persisted legacy-award upgrade/repeated-migration tests are included in the passing suite.
- Chrome-channel Playwright: **10/10 passed** across desktop and emulated mobile for ratings, series ratings, PlayerClass, original awards and result approval. The PlayerClass test covers 36 locale/theme/appearance/device combinations and the English table Axe checks.

Browser command (with an explicitly isolated `TEST_DATABASE_URL`):

```sh
PLAYWRIGHT_CHANNEL=chrome npx playwright test \
  tests/e2e/ratings.spec.ts tests/e2e/series-rating.spec.ts \
  tests/e2e/player-class.spec.ts tests/e2e/awards.spec.ts \
  tests/e2e/results.spec.ts
```

The browser database is separate from integration fixtures to prevent concurrent truncation. All identities/scores are synthetic. Existing [visual evidence](../yumu-rating/README.md) documents the same features.

Remote CI (Node 24/Linux) remains authoritative and its actual status is recorded in the integration PR. Local success is not a claim that queued/running CI passed. No deployment, production migration, real OAuth or organizer rehearsal was performed here. New Chinese wording/class-name review remains separate from code integration and is not inferred from a successful test.
