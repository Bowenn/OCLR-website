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

The live draft gate in #10 additionally requires #12–#15, mixed captain-direct/staff-on-behalf concurrency and replay tests, separate publication boundaries, reconnect/restart recovery and an isolated multi-captain rehearsal before streaming. Do not close #10 based only on registration tests.
