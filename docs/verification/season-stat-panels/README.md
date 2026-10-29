# Compact season statistics panels

The S1–S7 overview grids no longer stretch the statistics list to the artwork's
height. They use the same centered, intrinsic-height layout as S8–S10. All ten
season themes use square statistics rows; public appearance variants retain
their existing shapes. Shared link targets and keyboard focus styles are unchanged.

Verification on 2026-10-29:

- Browser CSS fixture: 60 cases (ten seasons × light/dark × 320/390/1440px).
  Loaded repository stylesheets in root-layout order with representative archive
  markup and square synthetic artwork. All rows had 0px corner radius, compact
  heights (48–51px), and no document overflow. Desktop panels stayed within 28rem.
  This checks layout, not authenticated routes or server-rendered preferences.
- `npm ci`, ESLint, `git diff --check`: passed.
- `npm audit --omit=dev`: zero vulnerabilities.
- `npm run check`: type checking fails in the unchanged
  `tests/unit/site-origin.test.ts:36` because a `string | null` argument is passed
  to a string parameter. This is outside the CSS change.
- `npm run build`: compilation passed; the same existing TypeScript error
  prevents a successful full build.
- Full database-backed unit/integration and route E2E suites were not run.
