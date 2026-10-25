# Developer API authentication — #268

Local verification on 2026-10-25, using an isolated worktree and PostgreSQL
`oclr_268_test` on loopback port 55468. No demo/production database, service,
role grant, OAuth credential or environment file was used or changed.

## Implemented boundary

- `/developer` appears in the existing account menu only with an explicit current
  global Developer grant. The page issues one-time, short-lived opaque credentials,
  shows only saved metadata on subsequent loads, and revokes the user's own access.
- `/api/v1/me` authenticates only Developer bearer credentials, returns the token's
  selected read scopes, and supports real localhost CORS/OPTIONS/HEAD with consistent
  no-store responses, request IDs, limits and machine-readable errors.
- Every read checks the original live browser session and current grant. Token
  revocation, parent expiry/logout and role withdrawal take effect on the next
  request. Mixed Admin roles never become bearer write permissions.
- The automatic mutation inventory calls every existing non-v1/non-credential
  business mutation route with an Admin cookie plus a Developer bearer header.
  Every route rejects the request; all public tables and provider-call counts
  remain unchanged. Legacy provider-refresh GETs reject bearer transport too.
- Migration `0037` preserves existing sessions and roles on upgrade, supports
  repeated migration, enforces token constraints, cascades credentials on logout,
  and retains the secret-free authorization audit. Failed audit writes roll back
  both credential creation and revocation.

See [API policy and operator/client usage](../../developer-api.md) for TTL,
origin configuration, scope definitions, resource limits and response semantics.

## Results

| Check | Actual result |
| --- | --- |
| `npm run check` | Passed ESLint, generated route types and TypeScript; final check after the added inventory test also passed |
| Full `npm test` with isolated `TEST_DATABASE_URL` | 129 files passed; 927 tests passed and 1 skipped |
| Added inventory and affected API/model checks | 15/15 passed after adding the exhaustive mixed-role mutation test and stronger database snapshots |
| Fresh migrations and upgrade/repeated-migration checks | Passed in explicitly named isolated test databases |
| `npm run i18n:extract` / `npm run test:i18n` | Catalogs synchronized; 4/4 checks passed |
| `npm run build` | Passed with the normal Next.js 16.4.2 Turbopack production build |
| Targeted desktop/mobile browser checks | 8 scenarios passed across affected reruns: Developer API (2), existing Developer workspace (2), scoped staff roles (2), account menu (2) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `git diff --check` | Passed |

Browser tests used the installed Chrome channel in isolated profiles because this
machine has no bundled Playwright Chromium. The local test frontend used port
31468, separate from the production-build test backend on 3100. The existing
process on 3101 was left alone. Direct browser fetches used `credentials: omit`.
The full browser suite was not run locally; CI is reported separately.

The new page checks all three existing appearances, both themes and all three
locales on desktop and 320px mobile; account-menu regression also exercises 390px.
Tests verify header/menu geometry, no horizontal overflow, one-time token handling,
real preflight plus success/error reads, grant withdrawal/regrant, explicit token
revocation and parent logout. Screenshots were captured at the top of the page
with the new-token field hidden; they contain only synthetic identity and metadata.

## Screenshots

- [Desktop, original light](desktop-default-light.png)
- [Desktop, Swiss minimal dark](desktop-swiss-minimal-dark.png)
- [Mobile, original light](mobile-default-light.png)
- [Mobile, Swiss minimal dark](mobile-swiss-minimal-dark.png)

## Remaining review and scope

New Chinese authorization/token wording remains subject to organizer review under
AGENTS.md. CI must be recorded from its actual run, not inferred from local tests.
No live grants, real provider/OAuth checks, production migration or deployment are
claimed. Existing #10 organizer-attested release rehearsal is unchanged.

This completes stage 1's authentication surface. Profile/tournament data APIs
(#269), the no-local-database frontend adapter (#270), full page coverage (#271)
and consolidated API DX acceptance (#272) have not been implemented here.
