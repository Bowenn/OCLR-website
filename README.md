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

There are no seeded administrators. Verify the first administrator's numeric osu! profile ID out of band, explicitly place that ID in the server-only `ADMIN_OSU_IDS` comma-separated bootstrap allowlist, deploy/restart, and authenticate normally. Legacy `STAFF_OSU_IDS` is ignored: review each old operator's responsibilities before explicitly granting a role. Never copy the old list automatically.

Administrators manage persistent Admin, Mappooler and Referee assignments at `/admin/staff`. Recipients must first authenticate through osu!. Grants may be global or limited to a configured edition; multiple grants combine capabilities. An edition administrator can only grant/revoke roles within that edition. Every confirmed grant/revocation records actor, recipient, scope and reason. Revocation applies on the next server check, including existing sessions. Captains receive no staff privileges from their appointment.

Keep bootstrap access restricted for recovery. An environment bootstrap administrator cannot be revoked through the website: remove the ID from `ADMIN_OSU_IDS` and restart. Before removing the final bootstrap ID, verify a persistent global Admin can sign in. A scoped Admin cannot recover global access. Never grant roles from usernames, client cookies or request-supplied actor identities.

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

## Broadcast overlay

The read-only `/tournaments/[edition]/draft/overlay` browser source is designed for 1920×1080; `?background=transparent` enables compositing. It shows only published picks, the selecting captain/team, current turn and roster progress. Both pick methods use the same feed. Reconnect/reload does not mutate or replay the draft. See [OBS setup and rehearsal](docs/deployment.md#obs-browser-source) for source settings and verification limits.

## Competition mappools

Admin and Mappooler assignments grant access to `/admin/tournaments/[edition]/mappools`. Create independently named/ordered rounds under Group Stage or Knockout Stage, then draft pools. NM/HD/DT/HR/FM/TB slots have database-unique category/index positions. FM is disabled unless explicitly configured as Free Mod or Force Mod; enter only approved restrictions. Changing category/index, replacing/removing a map, reordering, refreshing metadata and publishing all require a confirmed reason and current pool version. Conflicting edits return 409 and refresh the editor.

New/replaced maps use numeric IDs or canonical osu! difficulty links. Server-side [official osu! API](https://osu.ppy.sh/docs/#get-beatmap) lookup uses a client-credentials `public` token with `OSU_CLIENT_ID`/`OSU_CLIENT_SECRET`, separately from user sign-in. Tokens never reach browser clients. Metadata is persisted; public reads never query osu!. Provider failures/deletions preserve existing entries. The process spaces provider calls, bounds queues/timeouts/retries, coalesces identical lookups, caches metadata for one minute and reports rate limits for a later retry. When scaling Node processes, keep aggregate provider traffic within the official shared application limits. Without real credentials, automated synthetic responses verify the integration; live metadata lookup remains unverified.

Only released pools are returned by public pages/APIs, including direct UUID requests. Unpublish explicitly before editing; full revisions remain in private audit history. A completed-fixture lock permanently prevents map/settings/round-label changes, even after unpublishing. Create a new pool rather than rewriting historical competition maps; the results service sets this lock atomically when a fixture is approved. An unpublish can remove a locked pool from public queries without modifying its historical contents.

## Public player directory

`/players` and `/api/players` are anonymous reads with search, edition filtering and bounded pagination. Database queries select only published captain identities and members of finalized, published rosters with published team/captain identity. Acceptance alone never publishes a registration. Unpublishing any required identity/roster flag removes the relevant information on the next read; private forms, reasons and staff notes are never queried. `/dashboard` continues to show only the authenticated user's private registrations.

## Competition fixtures and result foundation

Admin manages `/admin/tournaments/[edition]/matches`; Referee assignments expose only that operator's fixtures. Both teams must have finalized, published identities/rosters. Fixtures reference existing edition/round/team IDs and an optional pool from the same round. Enter confirmed match times in UTC, retain the IANA display zone, or leave time TBA. Changes require an explicit reason and current version; published fixtures must first be unpublished before amendment. Winner/loser links are optional, explicitly configured knockout relationships; cycles and cross-edition/stage references are rejected. No automatic forfeits or advancement rules are assumed.

Round scoring remains `null` until explicitly configured: rules version, game mode, supported team/scoring mode, score aggregation, players per game, first-to/fixed-map series and substitution policy. Ranking remains pending without separately approved points and ordered tiebreak criteria; missing draw points cannot be guessed. Approved historical scoring rules cannot be silently rewritten. Round configuration uses the existing edition audit stream; fixture, import and result operations use a private fixture audit stream.

`fixtureForReview(actor, editionSlug, fixtureId)` is the importer contract: freshly authorized assigned Referee/Admin, fixture/version, stage/round/rules, the two stable team IDs and finalized roster osu! IDs, optional associated map IDs/FM policy, result state and private history. Role/assignment removal applies to subsequent calls. The database separates scheduled fixture status (`scheduled`, `in_progress`, `cancelled`) from result review state (`draft`, `submitted`, `approved`) and explicit approved-revision publication. Source fingerprints, per-import game uniqueness, result revisions and per-edition game claims support the single pipeline: Fixture → MP import → referee review → Admin approval → explicit publication. A source import alone cannot create or publish an official score. The referee workflow below uses these records; a public result adapter is a separate dependent checkpoint.

## Multiplayer source parsing

The single server API client uses the official [Get Match endpoint](https://osu.ppy.sh/docs/#get-match), `public` client-credentials scope and response version `20220705`. The independent history fetcher requests ascending `after` pages (100 events), deduplicates events/games, checks reported boundaries and detects history/game changes during retrieval. Imports are bounded to 100 pages, 10,000 events, 3,000 games and 8 MiB of aggregate provider responses; reaching an incomplete range cannot produce a final result. It retains validated scoring/event provenance and omits unrelated provider user profiles. A SHA-256 fingerprint excludes retrieval time so identical source facts remain idempotent; refresh comparisons identify added, removed and changed games.

The side-effect-free scorer attributes players using the fixture's official team IDs and rosters, never lobby-title names. Every source game requires an explicit include/exclude decision; exclusions require reasons. Included games require mod/rule confirmation and explanation of warnings/overrides. Non-roster players require a permitted, explicitly justified substitution attribution and eventual Admin approval; official rosters are unchanged. Incomplete, conflicting, mixed-team or unsupported scores cannot silently produce winners. Scoring needs explicitly approved sum/average aggregation, first-to/fixed-map completion, player count, failed-score policy, tied-map policy and understrength/substitution policies. Unknown Force Mod restrictions block compliance. Missing rules, incomplete history, unreviewed games, extra games and unresolved ties prevent a final result. No automatic forfeits or lobby-title team parsing exist.

An unauthenticated request to the organizer's `117427458` example returned HTTP **403** in this environment. No real osu! client credentials were present. Its actual teams, games and final score have **not** been verified or fabricated. Automated responses are clearly synthetic fixtures. These parser/scorer checks do not establish that a hosted referee workflow or live provider integration is operational; the isolated PostgreSQL and browser rehearsals below validate protected persistence/review/publication, while live provider and hosted verification remain external gates.

## Referee review and result approval

An assigned Referee or Admin opens `/admin/tournaments/[edition]/matches/[fixtureId]`, imports a canonical osu! MP link using the server-side client-credentials configuration, and reviews every game. Include/exclude decisions, exclusion/override reasons, explicitly permitted substitutions and mod compliance are validated again on the server. The UI displays the current scoring policy and derived series; no client-supplied winner or score is accepted. Internal reasons and individual provider scores stay staff-only. The separate public result note is intended for publication.

Every import is fingerprinted and immutable. Identical imports reuse stored games; retries use actor-scoped request keys. Changed source histories show added, removed and changed games and require new review. Competing submissions with the same expected version produce one committed result and a 409 conflict. Reload and server restart read authoritative database state. Provider failures preserve prior sources and results.

Submitting creates a numbered immutable revision containing source, roster, pool and scoring-rule evidence. Only Admin can approve, reject, withdraw or publish. Approval reserves the included game IDs within the edition and permanently freezes the associated mappool. Publication requires both explicit Admin approval and a published fixture; imports or referee submissions never publish automatically. A correction follows the same review/approval/publication sequence. The old published revision remains authoritative until its replacement is explicitly published. Unpublishing withholds the public result; withdrawal also releases game claims, preserving all source/revision/audit history and inventing no forfeit. Active reports must be withdrawn before changing fixture identity; scoring corrections require an explicit new rules version and never rewrite saved approved snapshots.

Automated validation uses synthetic official-shaped API responses, real PostgreSQL transactions and isolated desktop/mobile browser sessions. Browser tests seed stored synthetic snapshots directly into the test database; there is no production mock provider or authentication bypass. The organizer's real match and a hosted deployment still require live credentials and supervised verification.
