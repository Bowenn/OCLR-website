# OCLR — osu! Chinese League Rookie

Official community tournament website. OCLR is not affiliated with or endorsed by osu!.

## Local development

Use Node.js 24 LTS (minimum 22.13) and npm. Run `npm ci`, then `npm run dev` and open http://localhost:3000. Copy `.env.example` to `.env.local` when configuration is needed; never commit secrets.

One Next.js App Router application uses strict TypeScript, React and Tailwind CSS. Shared tokens and responsive patterns live in `src/app/globals.css`. Static tournament information works without external services; authentication, registration, teams and live draft data require PostgreSQL. Empty production content stays unpublished until approved by organizers.

## Checks and hosting

`npm run check` runs ESLint, generated route types and TypeScript. `npm run build` creates the production build; `npm start` serves it on a conventional Node.js host. CI runs the same checks. No Vercel services are required.

## Design and content

The committed `docs/design/oclr-website-concept.webp` is a visual reference only. Its dates, statistics, format, identities and expanded tournament name are placeholders. The correct name is **osu! Chinese League Rookie**. Registration is individual; teams are formed through the staff-appointed captain draft.

## Tournament content

Edit `src/content/editions.json`, validated by `src/lib/editions.ts`, or mount an approved JSON file using `OCLR_EDITIONS_FILE` (absolute path). Production starts with **no published editions**. Synthetic examples live only in `tests/fixtures/edition.ts`. Each edition has an immutable unique slug, publication flag, summary, IANA time zone, versioned rules, eligibility disclosure, optional registration window/questions and schedule entries. Use `null` for undecided values; unpublished editions return 404. Dates must include `Z` or an explicit UTC offset and are displayed in the configured time zone. Registration requires published rules, eligibility disclosure and a valid open window. Updating rules must change their version; do not change approved rules silently during registration.

`npm test` runs configuration/business tests. `npm run test:e2e` runs Playwright against the production build (install Chromium using `npx playwright install chromium`; set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome). Test data must never be copied into production configuration.

The development dependency audit reports an esbuild development-server advisory through Drizzle Kit’s legacy loader and an upstream, unpatched `braces` stack-exhaustion advisory through Next.js lint tooling. No esbuild server or Drizzle Studio is exposed, and lint patterns are repository-controlled. `npm audit --omit=dev` is clean; review upstream patches regularly without downgrading the application or forcing unrelated dependency changes.

## osu! authentication and PostgreSQL

Set `APP_URL`, `DATABASE_URL`, `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, `PRIVACY_CONTACT_EMAIL` and an organizer-approved `PRIVACY_RETENTION_NOTICE`. Register **exactly** `APP_URL/auth/osu/callback` as the osu! callback, with no extra trailing slash. Follow the [official osu! OAuth documentation](https://osu.ppy.sh/docs/index.html#authentication). Only `identify` is requested. Neither OAuth access nor refresh tokens are stored; identity is refreshed on login. No password accounts or production test-auth route exist.

Run `npm run db:migrate` with `DATABASE_URL` exported in the shell (Next.js reads `.env.local`; Drizzle CLI does not). Generate reviewed SQL changes with `npm run db:generate`, commit the migration and snapshots, then apply migrations before deploying application code. Use separate databases and OAuth apps for staging/production, verified TLS for remote PostgreSQL and HTTPS on the canonical origin. Session cookies are HTTP-only, SameSite=Lax, host-only, and Secure with `__Host-` names on HTTPS. Raw 256-bit session tokens never enter the database; only SHA-256 hashes do. Sessions expire after seven days; logout revokes the current session. OAuth state is one-use, browser-bound and expires after ten minutes. Reverse proxies must redact callback query strings and never log Authorization or Cookie headers.

Database-backed tests require **an isolated database whose name contains `test`**, passed explicitly as `TEST_DATABASE_URL`. Apply migrations there first, then run `TEST_DATABASE_URL=... npm test`. Provider HTTP responses are mocked only inside test files; callbacks, state consumption and sessions use real PostgreSQL. Live osu! consent/token exchange requires organizer-owned credentials and remains unverified until staging login/logout with two real accounts is performed.

## Registration lifecycle

Applications are **individual**, with one database-enforced record per stable osu! identity and edition (including withdrawn/rejected records). No automatic resubmission is provided. Only edition-approved text questions are collected. Eligibility is disclosed and acknowledged; staff assess the approved rules manually, never inferred rank/country/age restrictions or claims of official osu! validation. Unknown fields, forged identities, missing acknowledgments and stale rule versions are rejected. Repeated/concurrent submissions cannot create duplicates.

`pending` means awaiting staff review; staff may change it to `accepted` or `rejected`. A player may withdraw a `pending` or `accepted` application only before the explicitly configured `withdrawUntil` and while the edition is unlocked. `withdrawn` is terminal; rejection cannot be changed by a player. No withdrawal deadline means no self-service withdrawal. Captain appointment/locked draft state prevents self-service withdrawal and requires staff review. Every transition is recorded with actor and time; review is separate from captain/team assignment. Edition-scoped transaction locks serialize eligibility-affecting changes and draft lock against withdrawals/submissions.

## Staff provisioning and reviews

There are no seeded administrators. The organizer must verify each person's numeric osu! profile ID out of band, add only those IDs to the server-only `STAFF_OSU_IDS` comma-separated allowlist, deploy/restart and have them authenticate normally. An empty list denies everyone. Remove IDs and restart to revoke staff access immediately, including existing sessions. A captain is never implicitly staff. Never grant access from usernames, request fields or client cookies.

Staff access `/admin`; all page queries, APIs, reviews and exports also enforce authorization on the server. Pending applications may be accepted/rejected with explicit confirmation; rejection requires a player-visible explanation. Reviews use transaction locks and a version check, so stale or concurrent decisions are rejected. Locked editions cannot be reviewed. Audit events include actor, before/after status, timestamp and reason. CSV exports contain only ID, username, edition, status and submitted time; formulas/control-prefixed cells are neutralized and quotes escaped. Approved question answers and internal audit data are excluded from CSV. Exports are limited to 10,000 filtered rows and should be handled as private staff data.

## Release operations

[Deployment and recovery](docs/deployment.md) covers environments, migrations, HTTPS/Host routing, privacy operations, backups/rollback, logging, ingress limits and the unresolved external launch gates. `npm run release:check` is an explicit configuration/database preflight; it is not a claim that deployment or live osu! verification succeeded. `npm run db:cleanup` removes expired sessions/state. CI provisions isolated PostgreSQL, applies migrations and runs static checks, database tests, production build, desktop/mobile browser workflows, accessibility checks and the production dependency audit.

## Captains and eligible pool

Staff use `/admin/tournaments/[edition]/captains` to appoint/revoke/replace accepted, available individual players, save a complete captain order, mark a noncaptain unavailable with a reason, and lock reviewed setup. There are no assumed captain counts, roster sizes, clocks or snake rounds. Every command requires confirmation, reason and current setup revision; edition locks and database uniqueness protect concurrent actions. Captains cannot withdraw themselves or gain staff powers. Captain/pool identities remain private until an explicit staff publication approval. Locked setup rejects normal changes; supervised recovery must be handled through the draft controls rather than silent edits.

## Teams

Staff configure exactly one approved team identity per captain at `/admin/tournaments/[edition]/teams` **before locking setup**. Optional capacity is a maximum including the captain, not an invented required roster size. Captain membership is created transactionally. A partial unique PostgreSQL index enforces one active membership per player per edition; composite foreign keys prevent cross-edition assignments. Revoking an unstarted captain archives their team and ends membership without erasing history. Assigned draft rosters require supervised correction.

Captains view only their own team at `/tournaments/[edition]/team`; no self-service team creation, invitations, roster edits or unapproved branding edits exist. Public `/teams` routes project approved identities only. Rosters require finalization by the draft engine and separate staff publication. Private memberships, capacity, internal operations and unpublished identities are excluded. The bracket consumes these finalized, published team IDs directly.

## Authoritative draft engine

Both the active captain and authorized staff use **the same** `pickPlayer` command and `/api/tournaments/[edition]/draft/picks` endpoint. A request contains only session ID, expected revision, turn index, candidate ID and idempotency key. Actor, action mode and receiving captain/team are derived on the server. One transaction locks edition/session, validates the frozen pool and current turn/capacity, inserts the uniquely constrained pick and membership, advances the turn/revision and records the actual actor/mode in the private audit. Captain status never grants staff control.

Staff explicitly configure the **full team-ID turn sequence** after reviewed captain/team setup is locked. No roster size, randomization, snake order or clock is inferred. `ready` freezes accepted available players and validates team capacities/sequence. States: setup → ready → live ↔ paused → completed → finalized; staff can abort only from setup/ready/paused/completed, then recover to unlocked setup with an audit reason. Every control uses expected revision and confirmation.

Committed changes and publication are separate. Staff `publish` creates immutable public/captain snapshots from validated state; public snapshots exclude actor IDs, action modes, private answers, audit reasons and idempotency keys. Remaining pool identities require separate approval. Captain snapshots contain only the published board plus approved eligible identities needed for selection. A new pick is blocked until the current turn/state has been published; staff must publish after picks/state changes. Public reads never advance a draft. Duplicate retries by the same actor/key return the existing receipt; different payloads with the same key fail.

Supervised corrections are deliberately limited: pause (or complete), void the last pick with a reason, preserve its history, end its membership, publish the corrected snapshot, resume and publish before picking again. Earlier corrections require undoing subsequent picks in reverse order, or explicit abort/recovery; finalized drafts are immutable. Abort voids draft picks/memberships and preserves audit/history. Finalization requires all configured turns committed, roster invariants satisfied and last picks published, then marks teams finalized. Team roster publication remains a separate explicit staff approval. Unconfirmed substitutions/post-finalization corrections are not invented.

## Read-only brackets and results

Edit `src/content/brackets.json` or mount `OCLR_BRACKETS_FILE`. There are no production fixtures. Configure the approved format label, named sections/rounds, unique match IDs, explicit two-slot entrants, supplied scores/winner index, optional result note, authoritative source and update timestamp. Slots reference a finalized published team UUID, the winner/loser of another match, an explicit bye or TBA. The renderer does not choose the tournament format, generate results or run competition rules. Scores remain unreported when absent. Source cycles, missing match references, self-matches, duplicate IDs and inconsistent winners are rejected; adjudicated score exceptions require a reviewed note.

Only team IDs with **finalized and explicitly published rosters** may appear. Finalized team names are immutable through the app, giving the bracket a stable team identity. Hiding a roster also withholds its bracket. Staff update results by reviewing and committing the approved JSON with its source/timestamp, running checks and redeploying (or atomically replacing approved mounted content). The UI offers section controls, scrollable connected rounds, winner highlighting and a keyboard-accessible full match list. Synthetic winner/loser/bye fixtures are under `tests/fixtures` only.

## News, About and public participants

Approved editorial content lives in `src/content/announcements.json` (or mounted `OCLR_ANNOUNCEMENTS_FILE`). Each entry has a unique slug, title, summary, publication flag/time and plain-text heading/body sections. Set `published: false` while drafting; published entries require a date and future-dated entries stay hidden until that time. Text is escaped, not executed as HTML. Add/review content in Git and redeploy, or atomically replace the approved mounted file; there is no CMS or separate editorial service. Production content starts empty. Synthetic announcements are restricted to tests.

About uses only the verified OCLR identity/workflow. Set `site.contact` in `src/content/site.ts` only after the organizer approves an actual public contact. Do not infer organizer identity from repository ownership. Participant pages show explicitly published captain identities and finalized published team rosters; they never enumerate individual applications or automatically announce accepted/unpicked players. Public pool disclosure remains a separately approved draft-board setting. Privacy/correction/removal requests use the approved privacy contact.
