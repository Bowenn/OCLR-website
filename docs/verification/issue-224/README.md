# Issue #224 — approved Developer profiles

The About page's Developer section now selects the `developer` role from the existing public staff service. Previously it selected no roles, so even approved profiles rendered as “Not announced”. Role grants remain private until an authorized Admin explicitly publishes them; hiding or revoking a grant still removes its public profile.

Verified on 2026-10-24 in an isolated worktree, with separate `oclr_developer_roster_test` and `oclr_developer_roster_browser_test` PostgreSQL databases. Full checks ran on `963d8f0`; after main received the already-verified #223 teams navigation change, the branch was fast-forwarded to `42d22d7` and the production build and affected browser workflows were rerun. No demo or production database was used.

- The new server-rendered publication regression failed before the fix and passed afterward (5/5 focused publication tests).
- `npm run check`: passed (ESLint, Next route types, TypeScript).
- `npm test` with `TEST_DATABASE_URL`: 113 files passed; 829 tests passed, one existing skip.
- `npm run build -- --webpack`: passed. Webpack is used because this worktree shares dependencies through a symlink.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/public-staff.spec.ts tests/e2e/developer.spec.ts tests/e2e/tournament-teams-navigation.spec.ts`: 8/8 passed on the updated base, covering desktop/mobile publication, hiding, revocation, private grant isolation, light/dark rendering without horizontal overflow, accessibility, existing Developer private read access, and current/historical teams navigation. The two staff suites also passed 6/6 before syncing #223.
- `npm audit --omit=dev --audit-level=moderate`: zero vulnerabilities.
- No interface messages changed; existing translations and presentation components are reused.

The images use a synthetic published Developer and a stubbed avatar.

| Theme | Desktop                                                    | Mobile                                                   |
| ----- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Light | [developer-desktop-light.png](developer-desktop-light.png) | [developer-mobile-light.png](developer-mobile-light.png) |
| Dark  | [developer-desktop-dark.png](developer-desktop-dark.png)   | [developer-mobile-dark.png](developer-mobile-dark.png)   |

GitHub CI is reported separately. No deployment was performed.
