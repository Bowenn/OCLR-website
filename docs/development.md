# Development guide

Local setup, developer checks, design references, authentication, and database development. For live hosting, production migrations and rollback, use the [deployment runbook](deployment.md).

## Local development

Use Node.js 24 LTS (minimum 22.13) and npm. Run `npm ci`. For database-backed features, copy `.env.example` to `.env.local`, configure `DATABASE_URL`, and run `npm run db:migrate` before starting the app. Run `npm run dev` and open http://localhost:3000. Never commit secrets.

One Next.js App Router application uses strict TypeScript, React and Tailwind CSS. Shared tokens and responsive patterns live in `src/app/globals.css`. Static tournament information works without external services; authentication, registration, teams and live draft data require PostgreSQL. Empty production content stays unpublished until approved by organizers.

## Checks and hosting

`npm run check` runs ESLint, generated route types and TypeScript. `npm run build` creates the production build; `npm start` serves it on a conventional Node.js host. CI runs the same checks. No Vercel services are required.

## Design and content

The committed `docs/design/oclr-website-concept.webp` is a visual reference only. Its dates, statistics, format, identities and expanded tournament name are placeholders. The correct name is **osu! Chinese League Rookie**. Registration is individual; teams are formed through the staff-appointed captain draft.

Public tournament editions now follow the organizer-supplied [MainSheet Light reference](design/mainsheet-light/README.md): lavender surfaces, horizontal section navigation, artwork-led overview, match card/compact views, visual mappools with map details, team browsing and an indexed rules handbook. Admin, private Player/Captain tools and OBS retain their existing layouts. Reference sample teams, dates, scores and rules are never production tournament content. Localization is tracked separately in [#72](https://github.com/PhoenixEmik/OCLR-website/issues/72).

Visitors can select the default or cute-pastel appearance in the header, independently of light/dark. A whitelisted `oclr-appearance` cookie restores the choice during server rendering across public and private pages; OBS remains isolated. The pastel palette, local Quicksand font and selected presentation styles are adapted from `style/cute-pastel-ui` (9d95608). No edition configuration, automatic edition opt-ins, preview cookies, stage-completion inference or mappool workflow changes are imported.

## osu! authentication and PostgreSQL

Set `APP_URL`, `DATABASE_URL`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `PRIVACY_CONTACT_OSU_ID`. Register **exactly** `APP_URL/auth/osu/callback` as the osu! callback, with no extra trailing slash. Follow the [official osu! OAuth documentation](https://osu.ppy.sh/docs/index.html#authentication). Only `identify` is requested. Designate one verified Admin using a positive numeric osu! ID in private `.env.local`; do not copy the bootstrap allowlist. Existing sessions and identities remain intact, but new sign-in and registration fail closed until a valid designated privacy contact is configured. See [privacy contact setup](deployment.md#privacy-contact-setup) when upgrading from the email setting. Neither OAuth access nor refresh tokens are stored; identity is refreshed on login. No password accounts or production test-auth route exist.

Run `npm run db:migrate` after pulling database changes and before starting the updated app. The Drizzle configuration uses Next.js environment loading, including `.env.local`; an explicitly exported `DATABASE_URL` takes precedence. CLI commands default to development environment files; set `NODE_ENV=production` when using production files. Migration `0017` adds `staff_roles.about_published`; missing it causes Staff Management queries to fail. Existing staff stay private after migration. Generate reviewed SQL changes with `npm run db:generate`, commit the migration and snapshots, then apply migrations before deploying application code. Use separate databases and OAuth apps for staging/production, an explicit PostgreSQL transport choice from the deployment guide and HTTPS on the canonical origin. Session cookies are HTTP-only, SameSite=Lax, host-only, and Secure with `__Host-` names on HTTPS. Raw 256-bit session tokens never enter the database; only SHA-256 hashes do. Sessions expire after seven days; logout revokes the current session. OAuth state is one-use, browser-bound and expires after ten minutes. Reverse proxies must redact callback query strings and never log Authorization or Cookie headers.

Database-backed tests require **an isolated database whose name contains `test`**, passed explicitly as `TEST_DATABASE_URL`. Apply migrations there first, then run `TEST_DATABASE_URL=... npm test`. Migration-upgrade tests create and drop isolated temporary databases, so the test role needs `CREATEDB`; never use a production/runtime role. Provider HTTP responses are mocked only inside test files; callbacks, state consumption and sessions use real PostgreSQL. Live osu! consent/token exchange requires organizer-owned credentials and remains unverified until staging login/logout with two real accounts is performed.
