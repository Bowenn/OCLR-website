# OCLR — osu! Chinese League Rookie

Official community tournament website. OCLR is not affiliated with or endorsed by osu!.

## Local development

Use Node.js 24 LTS (minimum 22.13) and npm. Run `npm ci`, then `npm run dev` and open http://localhost:3000. Copy `.env.example` to `.env.local` when configuration is needed; never commit secrets.

One Next.js App Router application uses strict TypeScript, React and Tailwind CSS. Shared tokens and responsive patterns live in `src/app/globals.css`. Public content requires no external services. Unimplemented destinations explicitly report availability and expose no private data.

## Checks and hosting

`npm run check` runs ESLint, generated route types and TypeScript. `npm run build` creates the production build; `npm start` serves it on a conventional Node.js host. CI runs the same checks. No Vercel services are required.

## Design and content

The committed `docs/design/oclr-website-concept.webp` is a visual reference only. Its dates, statistics, format, identities and expanded tournament name are placeholders. The correct name is **osu! Chinese League Rookie**. Registration is individual; teams are formed through the staff-appointed captain draft.

## Tournament content

Edit `src/content/editions.json`, validated by `src/lib/editions.ts`, or mount an approved JSON file using `OCLR_EDITIONS_FILE` (absolute path). Production starts with **no published editions**. Synthetic examples live only in `tests/fixtures/edition.ts`. Each edition has an immutable unique slug, publication flag, summary, IANA time zone, versioned rules, eligibility disclosure, optional registration window/questions and schedule entries. Use `null` for undecided values; unpublished editions return 404. Dates must include `Z` or an explicit UTC offset and are displayed in the configured time zone. Registration requires published rules, eligibility disclosure and a valid open window. Updating rules must change their version; do not change approved rules silently during registration.

`npm test` runs configuration/business tests. `npm run test:e2e` runs Playwright against the production build (install Chromium using `npx playwright install chromium`; set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome). Test data must never be copied into production configuration.

The full development dependency audit currently reports an upstream, unpatched `braces` stack-exhaustion advisory through Next.js lint tooling. Lint patterns are repository-controlled. `npm audit --omit=dev` is clean; review upstream patches regularly without downgrading the application or forcing unrelated dependency changes.

## osu! authentication and PostgreSQL

Set `APP_URL`, `DATABASE_URL`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `PRIVACY_CONTACT_EMAIL` and an organizer-approved `PRIVACY_RETENTION_NOTICE`. Register **exactly** `APP_URL/auth/osu/callback` as the osu! callback, with no extra trailing slash. Follow the [official osu! OAuth documentation](https://osu.ppy.sh/docs/index.html#authentication). Only `identify` is requested. Neither OAuth access nor refresh tokens are stored; identity is refreshed on login. No password accounts or production test-auth route exist.

Run `npm run db:migrate` with `DATABASE_URL` exported in the shell (Next.js reads `.env.local`; Drizzle CLI does not). Generate reviewed SQL changes with `npm run db:generate`, commit the migration and snapshots, then apply migrations before deploying application code. Use separate databases and OAuth apps for staging/production, verified TLS for remote PostgreSQL and HTTPS on the canonical origin. Session cookies are HTTP-only, SameSite=Lax, host-only, and Secure with `__Host-` names on HTTPS. Raw 256-bit session tokens never enter the database; only SHA-256 hashes do. Sessions expire after seven days; logout revokes the current session. OAuth state is one-use, browser-bound and expires after ten minutes. Reverse proxies must redact callback query strings and never log Authorization or Cookie headers.

Database-backed tests require **an isolated database whose name contains `test`**, passed explicitly as `TEST_DATABASE_URL`. Apply migrations there first, then run `TEST_DATABASE_URL=... npm test`. Provider HTTP responses are mocked only inside test files; callbacks, state consumption and sessions use real PostgreSQL. Live osu! consent/token exchange requires organizer-owned credentials and remains unverified until staging login/logout with two real accounts is performed.
