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
