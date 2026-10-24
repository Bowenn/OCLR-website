# Issue #222 — restore public teams navigation

The public tournament menu now exposes Teams for both current and historical editions. Teams remains the active section on its list and detail routes instead of selecting Players. Existing routes, translations and team/roster release boundaries are reused.

Verified on 2026-10-24 in an isolated worktree based on `963d8f0`, using separately named `oclr_teams_navigation_test` and `oclr_teams_navigation_browser_test` PostgreSQL databases. No demo or production database was used.

- `npm run check`: passed (ESLint, Next route types, TypeScript).
- `npm test` with `TEST_DATABASE_URL`: 113 files passed; 828 tests passed, one existing skip.
- `npm run build -- --webpack`: passed. Webpack is used because this isolated worktree shares dependencies through a symlink.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/tournament-teams-navigation.spec.ts`: desktop and mobile passed (2/2), covering both edition types, all three appearances and light/dark themes. Each combination opens Teams from Players, checks the selected section, follows a team detail link and checks document width.
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities.
- Existing `Teams` translations are reused; no interface messages were added or changed.

Screenshots use synthetic data and the default dark appearance. The mobile captures show the expanded tournament menu.

| Edition    | Desktop                                          | Mobile                                         |
| ---------- | ------------------------------------------------ | ---------------------------------------------- |
| Current    | [current-desktop.png](current-desktop.png)       | [current-mobile.png](current-mobile.png)       |
| Historical | [historical-desktop.png](historical-desktop.png) | [historical-mobile.png](historical-mobile.png) |

GitHub CI is reported separately. No deployment was performed.
