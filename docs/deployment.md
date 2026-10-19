# Deployment and operations

This is a conventional Node.js 24 LTS + PostgreSQL 17 application. No deployment, domain, DNS or OAuth application has been provisioned by this repository. The local isolated tests are not a production launch.

## Required configuration

See `.env.example`. All variables are server-only; never add a `NEXT_PUBLIC_` prefix to credentials, database URLs or the staff allowlist.

| Variable                             | Purpose                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                            | Confirmed canonical origin, HTTPS in staging/production, no path or credentials                                                          |
| `DATABASE_URL`                       | PostgreSQL connection; use verified TLS for remote servers, a least-privilege runtime role and a separate migration role where supported |
| `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET` | Organizer-owned OAuth application, exact callback `APP_URL/auth/osu/callback`                                                            |
| `STAFF_OSU_IDS`                      | Verified numeric osu! IDs, comma-separated; empty denies all staff                                                                       |
| `PRIVACY_CONTACT_EMAIL`              | Approved operational privacy contact                                                                                                     |
| `PRIVACY_RETENTION_NOTICE`           | Approved public retention/deletion policy; a written policy must be operationally enforced                                               |
| `OCLR_EDITIONS_FILE`                 | Optional absolute path to mounted, approved edition JSON; default is bundled `src/content/editions.json`                                 |
| `OCLR_BRACKETS_FILE`                 | Optional absolute path to approved bracket/result JSON; default is bundled `src/content/brackets.json`                                   |
| `OCLR_ANNOUNCEMENTS_FILE`            | Optional absolute path to approved announcement JSON; default is bundled `src/content/announcements.json`                                |
| `PORT`                               | Optional listening port (Next.js default 3000)                                                                                           |
| `TEST_DATABASE_URL`                  | Isolated destructive-test database whose name contains `test`; never set it on production                                                |

Next.js reads `.env.local` for local development. CLI scripts expect exported environment variables or a secret manager injecting them. Do not place real secrets in command history, checked-in compose files or CI logs. A secret manager is preferred in production.

## Deploy a reviewed commit

1. Provision a separate staging database and organizer-owned osu! app. Confirm the actual hostname and HTTPS certificate. Do not infer a domain from the project name.
2. Install from the lockfile with `npm ci`. Keep build dependencies available in the build/release stage.
3. Run `npm run check`, isolated `npm test`, `npm run build` and database-backed `npm run test:e2e` as in CI. CI never uses production credentials/data.
4. Back up the target database. Review committed SQL under `drizzle/`, then run `npm run db:migrate` **once** against the target with migration credentials, before app instances accept traffic. Do not use `drizzle-kit push` in production. Migrations are tracked in the database; repeated migration runs are safe. Coordinate a single release process.
5. Configure approved edition content, privacy/contact policy and verified staff IDs. Run `npm run release:check` using the target environment. This checks configuration and database reachability, not live OAuth consent or deployment.
6. Start `npm start -- --hostname 127.0.0.1` under a supervised process manager. Keep the checkout, `.next`, `public`, runtime dependencies and mounted content available. Build as a separate release directory and switch traffic only when healthy. Full installation is the simplest supported deployment; standalone output is not configured.
7. Put a trusted HTTPS reverse proxy in front. Preserve the canonical **Host** header, reject unexpected hosts at ingress, redirect HTTP to HTTPS and avoid caching authenticated HTML/API responses. Do not expose the Node port directly. Canonical GET/HEAD redirects use `APP_URL`; per-request script nonces, frame restrictions, MIME protection and HTTPS HSTS are emitted by the app.
8. Rate-limit login/callback and mutation routes at ingress. Set request body limits no larger than 32 KiB for JSON APIs. Redact callback query strings and never log cookies, tokens, Authorization headers or private answer bodies. Restrict health/DB administration to operators.
9. Verify staging with two real osu! accounts: authorize, decline, retry, sign out, expired session, own-data isolation, individual submission, duplicate prevention, permitted withdrawal, staff review and CSV. Check privacy/contact links, keyboard/mobile navigation, approved rules/timezone and a failed database response. Record results in #5/#10.
10. Only after those checks, configure the production environment independently, apply reviewed migrations and verify the actual deployed URL. A passing local build is not evidence of a successful deployment. Keep registration unpublished/closed until the organizer authorizes collection.

## Backups, rollback and privacy operations

Use encrypted automated PostgreSQL backups (and point-in-time recovery where available), restricted operator access and restore drills into an isolated database. Before each release, take a recoverable snapshot and verify retention according to the organizer's actual policy. Maintain a secured copy of approved edition/content configuration alongside database backups.

Rollback application code to the last verified commit/release directory and restart; do not automatically reverse destructive migrations. Current migrations are additive. For future incompatible schema changes, use expand/contract migrations and test the old application against the new schema. If database restore is needed, stop writes, restore to a new isolated target, validate consistency and intentionally switch connections; never overwrite a live database blindly.

Run `npm run db:cleanup` daily to remove expired OAuth state and session records. Signing out revokes the current session. Removing a staff ID and restarting revokes staff powers for existing sessions. For account compromise, an operator may revoke all of a player's session hashes using a parameterized database query against `sessions.user_id`.

The approved `PRIVACY_RETENTION_NOTICE` must define application/identity/audit and backup retention, access/correction/deletion requests and any necessary tournament-integrity exceptions. Handle requests through the configured contact after verifying identity. Delete private answers/identities only through a reviewed transaction that respects active tournament obligations and foreign keys; do not promise an unimplemented automatic retention schedule. Store exported CSV only where authorized and remove it per the same policy. Applications are never public by default.

## Outstanding release gates

Registration code is locally verified against PostgreSQL and browser tests. Actual organizer rules, edition dates/questions, privacy contact/retention policy, authorized staff identities, osu! credentials/callback, hosting/TLS, backups and deployed login verification remain external requirements. No DNS changes or production deployment have been performed.

Issues #12–#15 are implemented and covered by mixed captain-direct/staff-on-behalf concurrency/replay tests, publication isolation, process reconstruction and a synthetic multi-browser rehearsal. The live draft gate in #10 still requires organizer rehearsal with actual approved rules, hosting ingress and event scale before streaming. Do not close #10 on automated fixtures alone.

## Draft operator runbook and rehearsal

Confirm actual captain/team counts, eligibility, maximum roster capacity (including captain), full turn sequence, pool visibility, on-air publication timing and correction policy with organizers. None of these are inferred from the mockup. Keep substitutions/post-finalization changes unavailable until approved rules exist.

1. In an isolated staging edition, review individual applications, appoint captains and save their order; configure one approved team name/capacity per captain. Publish captain and team identities deliberately. Lock setup only after review.
2. In the staff draft room, append the reviewed captain order or select each turn explicitly; save the **entire** sequence. Freeze setup, start and publish the live state. Publication does not create picks.
3. Have Captain A sign in independently and confirm a player. Check the staff preview/audit, then publish. Have staff select on behalf of the next on-clock captain, inspect actual actor/mode and captain/team attribution, then publish. Repeat using both methods. Public/captain views poll every two seconds; network failures retain the last published snapshot with a reconnecting label, and no polling operation mutates state.
4. Test a simultaneous captain/operator attempt for the same turn: exactly one commits, the other sees a conflict, stale selections clear and all views converge after publication. Test duplicate delivery with the same key and altered payload, another captain's direct API call, paused selection, private API access and withheld publication. Private picks, operator identity and audit reasons must never appear in spectator data or page source.
5. For a correction, pause, record a reason, void only the last pick, review/publish the corrected snapshot, resume and publish before picking again. Correct earlier turns in reverse order. For setup/order recovery, pause then explicitly abort and recover; this voids draft picks/memberships while preserving history and reopens audited setup. Do not issue ad hoc roster SQL. Finalized sessions cannot be rewritten.
6. Complete all configured turns, publish the last picks, then finalize. Separately approve final roster publication on the team page. The read-only bracket consumes finalized, published team identities.
7. Disconnect/reconnect spectators and reload all roles. Restart a staging app process during an ongoing draft and verify persisted revision/order/rosters before enabling writes again. Exercise backup restoration separately in a disposable database. Test the actual hosting ingress and organizer-approved event scale before a real broadcast.

`TEST_DATABASE_URL=... npm run test:e2e` performs the isolated multi-browser rehearsal with synthetic accounts/session hashes only (no production authentication bypass). `npm test` additionally checks database races, idempotency, audited correction/finalization and reconstruction of an ongoing draft in a fresh Node.js process. Browser artifacts are saved under Playwright's portable test-results directory. Tests are serialized around the shared isolated database; individual race scenarios still send concurrent server requests. Automated fixtures demonstrate two captains/two planned picks, not a claim of capacity at an unconfirmed real event scale. Live OAuth/staging hosting and organizer rehearsal remain external launch gates.

## Availability and publication safeguards

Registration links check the configured window, required privacy configuration and persisted draft lock. Temporary database failures hide submission controls; server mutations always recheck independently. Static tournament rules/dates remain readable during database outages, while private queries fail closed. An idle database connection failure is handled without terminating the process; subsequent requests reconnect. Polling has a bounded timeout, retains the last published snapshot on network errors and clears protected data after a 401/403.

Committed roster corrections remain private until a corrected snapshot is published. Revoking public pool approval removes the published pool immediately, including an older stored snapshot. Browser caches must never override these publication checks.

A local recovery rehearsal also stopped and restarted the scratch PostgreSQL process during an ongoing synthetic draft: the public homepage remained readable, private API access returned a generic failure during the outage, the existing session recovered, and persisted revision/picks/memberships were unchanged. This verifies local recovery only; it does not replace a hosting failover or backup-restore drill.
