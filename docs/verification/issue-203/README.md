# Issue #203 — restore OCLR header branding

Verified locally on 2026-10-24 using a production build and isolated PostgreSQL databases `oclr_203_test` and `oclr_203_browser_test` in a disposable loopback-only instance on port 55483.

## Restored identity

- History identified `0df719d` as the header-only OCL change. Restore the complete OCLR component from its parent, including the approved R outline, accent gradient, original star position and 1465 × 430 viewBox. The outlines match `public/branding/oclr-wordmark.svg` from the selected identity introduced in `1f88317`.
- Restore the existing 132px desktop / 112px narrow-mobile sizing, theme-specific letter colors and localized OCLR home link name.
- Use the existing OCLR Wiki translation entry for header navigation, wiki headings and page titles: `OCLR 维基`, `OCLR 維基`, `OCLR Wiki`. Remove the obsolete OCL-only entries. The `/wiki` destination and authored article text remain unchanged.
- The initial desktop accessibility run found inactive homepage navigation at 4.41:1 contrast. Navigation now uses the existing secondary-text token, as the pastel appearance already did; active/hover styles remain intact. The final accessibility run passes.

## Verification

- `npm run i18n:extract` and `npm run test:i18n`: passed (4 localization tests).
- `npm run check`: lint and TypeScript passed; lint for the final browser test also passed.
- `npm test`: **107 files passed; 796 tests passed, 1 existing skip**. Includes integration tests against the explicitly named isolated test database.
- `npm run build`: final production build passed.
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test tests/e2e/header-branding.spec.ts tests/e2e/header-actions.spec.ts tests/e2e/accessibility.spec.ts`: **42 passed** on desktop/mobile.
- `npm audit --omit=dev --registry=https://registry.npmjs.org`: **0 vulnerabilities**.

The branding tests cover all **54 combinations** of three locales × three appearances × light/dark × 1440/390/320px widths. They compare the SVG paths to the approved asset, check its aspect ratio and uncropped artwork bounds, assert header controls do not overlap or leave the viewport, and check page overflow, localized wiki labels/titles, retained destinations, keyboard activation, mobile menu closure, header Axe checks and browser errors. Existing role-aware header tests also cover authenticated player/staff surfaces and account-menu geometry; public accessibility tests cover Home, Tournaments, Players, News, About, Privacy and Login.

All matrix screenshots are generated under ignored `test-results/`. Representative Traditional Chinese captures below were visually reviewed; mobile captures show the menu opened with the keyboard, including its visible focus indicator.

| Appearance    | Desktop, light, 1440px                             | Mobile, dark, 320px                             |
| ------------- | -------------------------------------------------- | ----------------------------------------------- |
| Default       | [Screenshot](desktop-default-light-1440.png)       | [Screenshot](mobile-default-dark-320.png)       |
| Cute pastel   | [Screenshot](desktop-cute-pastel-light-1440.png)   | [Screenshot](mobile-cute-pastel-dark-320.png)   |
| Swiss minimal | [Screenshot](desktop-swiss-minimal-light-1440.png) | [Screenshot](mobile-swiss-minimal-dark-320.png) |

[Additional mobile light capture at 390px](mobile-default-light-390.png).

These are agent-performed local checks. GitHub CI is reported separately in the issue; no deployment or live OAuth rehearsal was performed for this change.
