# Issue #228 — restore draft results navigation

The public tournament menu now exposes Draft results for both current and historical editions, linking to the existing edition-scoped `/draft` page. The draft page selects its own menu item instead of Players. The entry remains available before publication, when the existing awaiting-publication state is shown; it does not release draft data.

Verified on 2026-10-24 in an isolated worktree based on `42d22d7`, with separate `oclr_draft_navigation_test` and `oclr_draft_navigation_browser_test` PostgreSQL databases. No demo or production database was used.

- `npm run check`: passed (ESLint, Next route types, TypeScript).
- `npm test` with `TEST_DATABASE_URL`: 113 files passed; 828 tests passed, one existing skip.
- `npm run build -- --webpack`: passed. Webpack is used because the worktree shares dependencies through a symlink.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/tournament-draft-navigation.spec.ts tests/e2e/tournament-teams-navigation.spec.ts`: 4/4 passed on desktop/mobile, covering current and historical draft and team navigation in all three appearances and light/dark themes.
- The draft flow checks the entry before any snapshot is released, creates two authoritative selections through the existing service, verifies the completed private draft remains absent from the public page/API, explicitly publishes, and checks both released selections through the public menu. It also verifies historical picks, the selected menu item, mobile menu closure and no horizontal overflow.
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities.
- Existing Draft results translations are reused; no interface messages changed. Presenter and OBS paths remain unchanged.

Screenshots use synthetic published results and the default dark appearance. Mobile captures show the expanded tournament menu.

| Edition    | Desktop                                          | Mobile                                         |
| ---------- | ------------------------------------------------ | ---------------------------------------------- |
| Current    | [current-desktop.png](current-desktop.png)       | [current-mobile.png](current-mobile.png)       |
| Historical | [historical-desktop.png](historical-desktop.png) | [historical-mobile.png](historical-mobile.png) |

GitHub CI is reported separately. No deployment was performed.
