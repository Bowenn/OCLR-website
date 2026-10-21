# Deployment and operations

The deployment target is a Rocky Linux 10 Node.js application host, an existing separate PostgreSQL server and an existing separate Nginx proxy. CI verifies Node.js 24 and PostgreSQL 17; the actual external database version, permissions and networking must be rehearsed before launch. No deployment, domain, DNS or OAuth application has been provisioned by this repository. The local isolated tests are not a production launch.

## Required configuration

See `.env.example`. All variables are server-only; never add a `NEXT_PUBLIC_` prefix to credentials, database URLs or the bootstrap Admin IDs.

| Variable                             | Purpose                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                            | Confirmed canonical origin, HTTPS in staging/production, no path or credentials                                                          |
| `DATABASE_URL`                       | PostgreSQL connection; use verified TLS for remote servers, a least-privilege runtime role and a separate migration role where supported |
| `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET` | Organizer-owned OAuth application, exact callback `APP_URL/auth/osu/callback`                                                            |
| `ADMIN_OSU_IDS`                      | Explicitly verified bootstrap global Admin IDs; legacy STAFF_OSU_IDS grants no access. Persistent grants are managed at /admin/staff     |
| `PRIVACY_CONTACT_OSU_ID`             | Explicit single approved public osu! Admin ID (positive safe integer)                                                                    |
| `PRIVACY_RETENTION_NOTICE`           | Approved public retention/deletion policy; a written policy must be operationally enforced                                               |
| `OCLR_BRACKETS_FILE`                 | Optional absolute path to legacy bracket JSON (ignored for editions with DB fixtures); default is bundled `src/content/brackets.json`    |
| `OCLR_ANNOUNCEMENTS_FILE`            | Optional absolute path to approved announcement JSON; default is bundled `src/content/announcements.json`                                |
| `PORT`                               | Optional listening port (Next.js default 3000)                                                                                           |
| `TEST_DATABASE_URL`                  | Isolated destructive-test database with a separate `test` name segment, e.g. `oclr_test`; never set it on production                     |

Next.js reads `.env.local` for local development. Production shell commands expect exported environment variables or a secret manager injecting them. Do not place real secrets in command history, checked-in compose files or CI logs. A secret manager is preferred in production.

## Tournament configuration cutover

Migration `0013` extends the existing `edition_state` anchor rather than replacing its foreign keys. Configuration revisions are separate from draft/setup versions. The migration preserves S11 as unpublished, with no registration/rules/eligibility/dates and its approved local artwork. Existing registration rules-version strings, answers, captains, teams, picks, pools, fixtures and results remain untouched. Historical applications are not assigned invented acknowledgment snapshots; new applications reference an immutable saved configuration revision.

For a fresh installation, run committed migrations before starting the app; S11 is the only prepared edition. An installation without a database shows no public editions. There is no JSON fallback or per-start seeding. Configured database failures remain errors rather than loading stale file content.

For an upgrade, stop mutations and back up the target database before migrating. If the old installation used an external `OCLR_EDITIONS_FILE`, preserve that approved file securely, apply migrations, then run `npm run db:import-editions -- /absolute/path/approved-legacy.json`. The import is transactional and idempotent: identical imported content is a no-op, unknown existing anchors receive their supplied configuration, and differing configured DB content is rejected. To replace the untouched bundled S11 bootstrap once, explicitly add `--replace-bootstrap-s11`; this is accepted only for the exact revision-zero bootstrap and never overwrites a newer Admin revision. S11 stays private and imported registration windows are paused for deliberate review. Missing legacy content is left unconfigured, never fabricated; `release:check` blocks release until those anchors are imported. Remove the obsolete environment variable after cutover.

Verify the Admin list and each existing edition's identity, rules, links and publication before restoring traffic. Publish approved information deliberately and enable registration separately. Global Admins can create editions; scoped Admins can edit only their assigned editions. Mappooler and Referee assignments grant operational tools without general settings access. Existing URLs and stable slugs remain valid.

Before any post-cutover writes, rollback may restore the verified pre-migration backup with its matching old application release. After new writes, preserve the database and roll back only to a compatible DB-aware application release; do not drop new columns/tables, restore an old backup over new registrations, or resume a stale JSON writer. Review prior configuration snapshots in the private audit history and apply a forward correction with a new revision/rules version. Competition locks remain enforced; configuration rollback must not rewrite draft or result history.

Migration `0014` makes registration rule versions nullable and adds a nullable eligibility acknowledgment. Existing values are preserved and the new column is left null for historical applications; no consent is backfilled. After collecting no-rules applications, roll back only to a release supporting these nullable fields. Do not restore the old NOT NULL constraint or substitute invented versions.

## Deploy a reviewed commit

1. Provision a separate staging database and organizer-owned osu! app. Confirm the actual hostname and HTTPS certificate. Do not infer a domain from the project name.
2. Install from the lockfile with `npm ci`. Keep build dependencies available in the build/release stage.
3. Run `npm run check`, isolated `npm test`, `npm run build` and database-backed `npm run test:e2e` as in CI. CI never uses production credentials/data.
4. Back up the target database. Review committed SQL under `drizzle/`, then run `npm run db:migrate` **once** against the target with migration credentials, before app instances accept traffic. This release requires migrations through `0017`: `0012` makes routine audit explanations nullable and adds staff-role before/after state; `0013` adds canonical tournament configuration and registration revision references; `0014` supports optional Rules/Eligibility consent; `0015` adds referee assignment revisions; `0016` permits planned fixture participants; `0017` adds private-by-default staff About visibility. The Drizzle configuration loads Next.js environment files (development by default; set `NODE_ENV=production` for production files); an explicitly supplied `DATABASE_URL` takes precedence. Confirm the target before applying migrations. Historical records remain intact; release preflight checks the new columns and missing legacy configuration. Follow the tournament configuration cutover above before restoring traffic. Do not use `drizzle-kit push` in production. Migrations are tracked in the database; repeated migration runs are safe. Coordinate a single release process.
5. Configure approved edition content, privacy/contact policy and verified staff IDs. Run `npm run release:check` using the target environment. This checks configuration and database reachability, not live OAuth consent or deployment.
6. Start `npm start -- --hostname 127.0.0.1` under a supervised process manager. Keep the checkout, `.next`, `public`, runtime dependencies and mounted content available. Build as a separate release directory and switch traffic only when healthy. Full installation is the simplest supported deployment; standalone output is not configured.
7. Put a trusted HTTPS reverse proxy in front. Preserve the canonical **Host** header, reject unexpected hosts at ingress, redirect HTTP to HTTPS and avoid caching authenticated HTML/API responses. Do not expose the Node port directly. Canonical GET/HEAD redirects use `APP_URL`; per-request script nonces, frame restrictions, MIME protection and HTTPS HSTS are emitted by the app.
8. Rate-limit login/callback, metadata/import and mutation routes at ingress. Limit JSON bodies to 32 KiB, except the per-fixture `/results` review and `/api/admin/tournaments/[edition]` settings POSTs, which accept at most 512 KiB for explicit game decisions and structured rules respectively. Redact callback query strings and never log cookies, tokens, Authorization headers or private answer bodies. Restrict health/DB administration to operators.
9. Verify staging with two real osu! accounts: authorize, decline, retry, sign out, expired session, own-data isolation, individual submission, duplicate prevention, permitted withdrawal, staff review and CSV. Check privacy/contact links, keyboard/mobile navigation, approved rules/timezone and a failed database response. Record results in #5/#10.
10. Only after those checks, configure the production environment independently, apply reviewed migrations and verify the actual deployed URL. A passing local build is not evidence of a successful deployment. Keep registration unpublished/closed until the organizer authorizes collection.

## Privacy contact setup

Set `PRIVACY_CONTACT_OSU_ID` to one explicitly approved Admin's positive numeric osu! user ID in private `.env.local` (or the hosting secret/environment configuration). Do not use a comma-separated list, derive the first `ADMIN_OSU_IDS` entry, or publish other bootstrap IDs. About and Privacy share the canonical `https://osu.ppy.sh/users/{id}` contact; no direct-message URL is invented. The public link does not grant any staff permissions.

Verify the designated account is a global Admin, either explicitly provisioned through `ADMIN_OSU_IDS` or an active persistent global Admin grant. `release:check` checks this against the configured allowlist/database; ordinary privacy readiness validates the single ID and retention text without exposing or querying role assignments. Organizers must confirm the profile is reachable and the account can actually receive and handle privacy inquiries. A profile link alone does not establish legal compliance.

When upgrading, replace the old email contact setting with `PRIVACY_CONTACT_OSU_ID`, remove the unused email variable, and restart the application. Review your **private** `PRIVACY_RETENTION_NOTICE` so it contains the approved retention/deletion terms rather than an old contact list. On the public Privacy page, email addresses (including `mailto:` prefixes) are replaced with “the designated osu! contact”; the stored notice and its retention terms are preserved. No private environment values belong in commits or issue comments. Without a valid new contact and nonblank retention notice, new sign-in and registration remain unavailable; existing users, sessions and registration records are not deleted or disabled by this configuration change.

## Backups, rollback and privacy operations

Use encrypted automated PostgreSQL backups (and point-in-time recovery where available), restricted operator access and restore drills into an isolated database. Before each release, take a recoverable snapshot and verify retention according to the organizer's actual policy. Maintain a secured copy of approved edition/content configuration alongside database backups.

Rollback application code to the last verified commit/release directory and restart; do not automatically reverse destructive migrations. Current migrations are additive, including explicit staff roles, competition fixtures/imports/results and stage group-publication configuration. For future incompatible schema changes, use expand/contract migrations and test the old application against the new schema. If database restore is needed, stop writes, restore to a new isolated target, validate consistency and intentionally switch connections; never overwrite a live database blindly.

Run `npm run db:cleanup` daily to remove expired OAuth state and session records. Signing out revokes the current session. Revoking a persistent role at `/admin/staff` applies on the next server authorization check, including existing sessions. Removing a bootstrap Admin ID from the environment requires an application restart. For account compromise, an operator may revoke all of a player's session hashes using a parameterized database query against `sessions.user_id`.

The approved `PRIVACY_RETENTION_NOTICE` must define application/identity/audit and backup retention, access/correction/deletion requests and any necessary tournament-integrity exceptions. Handle requests through the configured contact after verifying identity. Delete private answers/identities only through a reviewed transaction that respects active tournament obligations and foreign keys; do not promise an unimplemented automatic retention schedule. Store exported CSV only where authorized and remove it per the same policy. Applications are never public by default.

## Outstanding release gates

Registration code is locally verified against PostgreSQL and browser tests. Actual organizer rules, edition dates/questions, privacy contact/retention policy, authorized staff identities, osu! credentials/callback, hosting/TLS, backups and deployed login verification remain external requirements. No DNS changes or production deployment have been performed.

Issues #12–#15 are implemented and covered by mixed captain-direct/staff-on-behalf concurrency/replay tests, publication isolation, process reconstruction and a synthetic multi-browser rehearsal. The live draft gate in #10 still requires organizer rehearsal with actual approved rules, hosting ingress and event scale before streaming. Do not close #10 on automated fixtures alone.

## Season 11 preparation and profile verification

The committed `s11` edition is **unpublished**. Rules, eligibility, registration windows and schedule are unset. `UTC` is a neutral display default while all times are TBA; replace it with the organizer-approved IANA zone when entering actual times. Artwork does not publish the edition or enable registration. The homepage uses the supplied text-free background with HTML content; the square logo appears on S11 edition cards and the full key visual is prepared for its overview. Mobile keeps the complete background composition and intrinsic image ratios. Review and save approved content in `/admin/tournaments/s11/settings`, then explicitly publish it and enable registration separately.

Apply migration `0011` before enabling profile pages. `release:check` verifies the cache columns as well as existing operational tables. Using actual server-side API credentials, an authorized Admin should send a same-origin authenticated `POST /api/admin/profiles` with `{ "input": "https://osu.ppy.sh/users/651307/osu" }`. Profile lookup is API-only; Captain cards use the same service in context. Confirm official username/ID, source/time, optional fields and selected ruleset; switch rulesets and check refresh throttling. This lookup must not create an account, approve an application or publish participation. For an explicitly published staging participant, verify anonymous profile access and then withdraw publication: cached statistics must become inaccessible on the next public request. Exercise provider failure with a saved snapshot and confirm the stale label without logging tokens.

The earlier unauthenticated profile request for user `651307` returned HTTP 403 and did not verify their statistics. On 2026-10-20, a local server-side client-credentials request successfully retrieved official beatmap `75`; production credentials and hosted API access still need verification. Real OAuth consent/callback (#5), live profile/MP reads, approved S11 rules and privacy/contact/retention, hosting/HTTPS/secrets/database backups, and the organizer's hosted staging rehearsal remain release gates in #10. The visible privacy page is a baseline notice awaiting organizer policy, not evidence of policy approval. Keep #5/#10 open until those checks are actually recorded.

## Draft operator runbook and rehearsal

Confirm actual captain/team counts, eligibility, maximum roster capacity (including captain), full turn sequence, pool visibility, on-air publication timing and correction policy with organizers. None of these are inferred from the mockup. Keep substitutions/post-finalization changes unavailable until approved rules exist.

1. In an isolated staging edition, review individual applications, appoint captains and save their order; configure one approved team name/capacity per captain. Publish captain and team identities deliberately. Lock setup only after review.
2. In the staff draft room, append the reviewed captain order or select each turn explicitly; save the **entire** sequence. Freeze setup, start and publish the live state. Publication does not create picks.
3. Have Captain A sign in independently and confirm a player. Check the staff preview/audit, then publish. Have staff select on behalf of the next on-clock captain, inspect actual actor/mode and captain/team attribution, then publish. Repeat using both methods. Public/captain views poll every two seconds; network failures retain the last published snapshot with a reconnecting label, and no polling operation mutates state.
4. Test a simultaneous captain/operator attempt for the same turn: exactly one commits, the other sees a conflict, stale selections clear and all views converge after publication. Test duplicate delivery with the same key and altered payload, another captain's direct API call, paused selection, private API access and withheld publication. Private picks, operator identity and audit reasons must never appear in spectator data or page source.
5. For a correction, pause, confirm voiding only the last pick, review/publish the corrected snapshot, resume and publish before picking again. Correct earlier turns in reverse order. For setup/order recovery, pause then explicitly abort and recover; this voids draft picks/memberships while preserving history and reopens audited setup. Do not issue ad hoc roster SQL. Finalized sessions cannot be rewritten.
6. Complete all configured turns, publish the last picks, then finalize. Separately approve final roster publication on the team page. The read-only bracket consumes finalized, published team identities.
7. Disconnect/reconnect spectators and reload all roles. Restart a staging app process during an ongoing draft and verify persisted revision/order/rosters before enabling writes again. Exercise backup restoration separately in a disposable database. Test the actual hosting ingress and organizer-approved event scale before a real broadcast.

`TEST_DATABASE_URL=... npm run test:e2e` performs the isolated multi-browser rehearsal with synthetic accounts/session hashes only (no production authentication bypass). `npm test` additionally checks database races, idempotency, audited correction/finalization and reconstruction of an ongoing draft in a fresh Node.js process. Browser artifacts are saved under Playwright's portable test-results directory. Tests are serialized around the shared isolated database; individual race scenarios still send concurrent server requests. Automated fixtures demonstrate two captains/two planned picks, not a claim of capacity at an unconfirmed real event scale. Live OAuth/staging hosting and organizer rehearsal remain external launch gates.

## Availability and publication safeguards

Registration links check the configured window, required privacy configuration and persisted draft lock. Temporary database failures hide submission controls; server mutations always recheck independently. Static tournament rules/dates remain readable during database outages, while private queries fail closed. An idle database connection failure is handled without terminating the process; subsequent requests reconnect. Polling has a bounded timeout, retains the last published snapshot on network errors and clears protected data after a 401/403.

Once the draft has been explicitly released, committed picks and guarded corrections update spectator/captain snapshots in the same transaction. Finalized team roster release remains separate. Revoking public pool approval removes the published pool immediately, including an older stored snapshot. Browser caches must never override these publication checks.

A local recovery rehearsal also stopped and restarted the scratch PostgreSQL process during an ongoing synthetic draft: the public homepage remained readable, private API access returned a generic failure during the outage, the existing session recovered, and persisted revision/picks/memberships were unchanged. This verifies local recovery only; it does not replace a hosting failover or backup-restore drill.

## OBS browser source

Use `/tournaments/[edition]/draft/overlay` for an opaque canvas, or append `?background=transparent` for compositing. In OBS, add a **Browser** source with the actual approved HTTPS URL, width **1920**, height **1080**, and the default browser-source CSS. The canvas itself controls the opaque variant, so OBS's transparent body CSS does not erase it. See the [official Browser Source settings](https://obsproject.com/kb/browser-source). No privileged cookie, token, login or OBS page permissions are required.

The overlay shows the latest published selection and its receiving captain/team, current published turn/status, recent picks and published roster progress. It uses the existing public snapshot endpoint every two seconds with one request at a time, an eight-second timeout and no credentials. A failed connection retains the last published state with a reconnecting label. Lower revisions of the same session cannot rewind the display; a publication retraction clears it. Reloads establish a baseline without replaying old pick animations. Newly published picks get a short reveal; reduced-motion preferences disable it. No countdown, round format or capacity is inferred. Large rosters remain keyboard-scrollable; test the actual organizer-approved roster count before airing.

Staff preview the same public URL and explicitly publish from the staff draft room. Hiding a browser source or changing scenes never makes a pick or publishes data. The existing staff publication/confirmation/audit controls govern both captain-direct and staff-on-behalf picks. Keep source refresh/shutdown preferences consistent with the broadcast workflow; reloads are safe but may briefly show the connecting state. OBS is only a renderer here: no video hosting, streaming credentials or streaming automation is part of the app.

The isolated browser rehearsal covers a four-turn repeating A/B/A/B order with both pick modes, withheld publication, stale-response rejection, disconnect/reconnect, pause, audited last-pick correction, finalization, transparent/opaque backgrounds, reduced motion, privacy checks, desktop/mobile reflow and automated accessibility. It runs against the production build and PostgreSQL using synthetic data; it does not establish that real OAuth or public hosting is operational.

A separate local rehearsal also loaded the production application in **OBS 32.0.4** with a 1920×1080 Browser source. Both captain-direct and staff-on-behalf selections were observed with correct team/captain attribution, including an embargoed staff pick, published pause, opaque/transparent variants and recovery after a real Next.js process restart. Four A/B/A/B picks were then finalized. No stream, recording, public deployment or real OAuth session was used. Native automation hit Qt accessibility crashes during dialog/collection changes; the isolated browser source rendered successfully after recovery, and the original OBS collection was restored afterward. Keep an independent organizer rehearsal on the actual broadcast machine as a release gate.

The final local recovery drill used `pg_dump` (custom format) and `pg_restore --no-owner --no-privileges --exit-on-error` to restore the separate synthetic broadcast database into a new UTF-8 test database. Ordered JSON fingerprints matched for all 12 application tables and the migration journal, including the finalized draft, rosters, picks, actor/mode history and test sessions; applying migrations again succeeded without changes. This verifies the local PostgreSQL backup/restore path. The production provider's backup retention, restore permissions, recovery time and operational restore rehearsal still require verification on the actual hosting environment.

## Public Staff visibility

Apply migration `0017` before deploying the public About roster. All existing and new grants default to private. Admins explicitly publish individual role/scope entries through **Show on About** in Staff Management; verify the person has approved public listing. Edition-scoped entries remain hidden while their edition is unpublished. Revoking or hiding a grant removes it on the next public read. Rollback can retain the additive column and audit records; do not promote existing grants or backfill public consent.

## Competition operations release rehearsal

Apply migration `0015` before deploying quick referee assignment. It adds a separate assignment revision without changing fixture/result versions or existing assignments. Roll back application code if needed; retain the additive column and audit history. Referee changes are saved from each fixture card using active edition-authorized Referee/Admin accounts. They do not invalidate an ongoing result review.

Migration `0016` makes fixture participant IDs nullable, retaining all foreign keys, existing fixtures and result history. Apply it before deploying planned/TBD fixture controls. Plan matches and assign referees without dummy teams; confirm two finalized, published teams before MP reporting. Published planned fixtures may expose their approved schedule and TBD/progression labels, never private team identities or referee assignments. To roll back, retain the nullable columns and history; do not restore `NOT NULL` unless every unresolved slot has been legitimately confirmed and checked. Back up before migrations.

Use verified `ADMIN_OSU_IDS` only to bootstrap the first global Admin; legacy `STAFF_OSU_IDS` grants nothing. Sign in with the organizer-confirmed osu! account, grant persistent Admin assignments through `/admin/staff`, verify a second authorized account, then remove the temporary environment bootstrap if desired. Role grants can be global or edition-scoped. Mappoolers receive only mappool capabilities; Referees receive only assigned-fixture reporting. Captains have no staff powers through captain status. Test direct requests with each role, not just navigation visibility.

Before reporting matches, publish finalized official rosters, configure actual Group/Knockout rounds and their approved scoring policies, create/release mappools and schedule fixtures with referee assignments. Publish group membership and point/tiebreak rules explicitly if standings are required. Unconfirmed match times, rules or grouping remain TBA/pending. Do not import a lobby until its two fixture teams are verified.

The server uses the same organizer-owned osu! application's `OSU_CLIENT_ID`/`OSU_CLIENT_SECRET` to request a separate client-credentials `public` token for official beatmap and multiplayer reads; player sessions do not retain provider tokens. Requests go only to fixed official API paths. Requests are paced, have bounded retries/timeouts and never expose tokens. History snapshots are bounded to 100 pages, 10,000 events, 3,000 games, 8 MiB and a two-minute retrieval budget; incomplete/unsupported data cannot become a final score. Allow at least 150 seconds at ingress for paginated imports (individual provider requests time out after ten seconds) and monitor provider rate-limit errors without logging sensitive bodies. Failures preserve stored official results.

In staging, exercise import, repeated import, changed-history comparison, warmup/rematch exclusion, failed/understrength policies, permitted substitutions, ties and extra games under approved rules. Have an assigned Referee submit and an Admin separately approve then publish. Verify anonymous schedule/results/bracket reads and the absence of internal reasons, unapproved games and individual provider scores. Revoke the Referee role and confirm subsequent requests fail. Correct a result through a new reviewed revision and inspect every dependent knockout fixture before publication; conflicting downstream scores are withheld until explicitly reconciled. Approval permanently freezes its associated pool, so create a new pool for future changes rather than altering played maps.

The earlier unauthenticated official request for example MP `117427458` returned HTTP 403; that match remains unverified. The successful local beatmap API check does not establish MP retrieval, pagination or the hosted referee integration. Synthetic fixtures validate parser/scorer, PostgreSQL transactions and browser workflows without claiming that example's teams or result. Verify current official API behavior, a real authorized match and the actual hosted referee workflow before a live event. Production hosting/TLS, OAuth callback consent, approved tournament rules and operational backup/retention remain organizer dependencies; automated CI does not establish deployment.

The competition-operations recovery rehearsal also used an independent synthetic database containing staff roles, finalized rosters, a mappool, imported games, an approved published result, audit history and a session. The production-build server returned the same result and authorized history after a real PostgreSQL stop/start and a separate Next.js process restart. During the database outage, the homepage remained readable and private APIs returned a generic failure. A custom-format backup was restored into a new UTF-8 database; ordered JSON fingerprints matched for all **27 application tables plus the migration journal**, and migration replay succeeded. This is local recovery evidence, not verification of a production provider's backup operations.

## Rocky Linux 10 application host

Rocky 10 uses ordinary DNF packages, not the old AppStream module-enable workflow ([Rocky release notes](https://docs.rockylinux.org/latest/releases/release_notes/10_0/)). Install only the app prerequisites on this host:

```sh
sudo dnf install nodejs nodejs-npm git
node --version
npm --version
```

The base Node.js 22 packages meet the application's **>=22.13** requirement; update them through your managed repositories. Node.js 24 is the CI reference, but versioned `nodejs24` packages can expose `node-24`/`npm-24` rather than standard names. If choosing that runtime, configure a consistent standard `node`/`npm` PATH for both build and service, and adjust the service executable; do not mix runtimes. Package availability is in the [official Rocky repository](https://download.rockylinux.org/pub/rocky/10/AppStream/x86_64/os/Packages/n/).

Use this topology: **Browser → existing Nginx (HTTPS) → Rocky app (private port 3000) → existing PostgreSQL (TLS)**. The public domain must point to Nginx, not directly to Node. Replace all uppercase/example values below with your actual settings. No production services have been provisioned by this repository.

**1. Prepare your existing database.** Follow [the PostgreSQL steps below](#existing-separate-postgresql-deployment-steps). Obtain a runtime URL, a separate migration URL and the trusted CA certificate from its administrator. Do not install PostgreSQL on the app host. Permit database connections only from the app/deployment host's actual private IP.

**2. Create an app account and first release directory.** On the Rocky application host, run these as your sudo-capable operator (fresh-install examples; reuse an existing account/path when appropriate):

```sh
sudo useradd --system --create-home --home-dir /var/lib/oclr --shell /bin/bash oclr
sudo install -d -o oclr -g oclr -m 0750 /opt/oclr/releases
sudo -u oclr -H git clone https://github.com/PhoenixEmik/OCLR-website.git /opt/oclr/releases/first
sudo -u oclr -H git -C /opt/oclr/releases/first rev-parse HEAD
sudo install -d -o root -g oclr -m 0750 /etc/oclr
```

Use a reviewed commit/release, not an unreviewed moving branch. Node/npm/setup run as `oclr`, never root. Do not run this first-clone command over an existing release directory.

**3. Write the runtime configuration.** Create `/etc/oclr/runtime.env` with your editor (`sudoedit /etc/oclr/runtime.env`). Use plain `KEY='value'` assignments, one per line, without `export`; quote values containing spaces, `&` or `$`. This must be a trusted administrator-written file: the operator shell sources it and systemd reads the same assignments.

```sh
APP_URL='https://oclr.example.com'
DATABASE_URL='postgresql://oclr_runtime:ENCODED_PASSWORD@DB_HOST:5432/oclr?sslmode=verify-full&sslrootcert=/etc/oclr/db-ca.pem'
OSU_CLIENT_ID='YOUR_OSU_CLIENT_ID'
OSU_CLIENT_SECRET='YOUR_OSU_CLIENT_SECRET'
ADMIN_OSU_IDS='YOUR_VERIFIED_ADMIN_OSU_ID'
PRIVACY_CONTACT_OSU_ID='YOUR_APPROVED_PUBLIC_CONTACT_OSU_ID'
PRIVACY_RETENTION_NOTICE='YOUR_APPROVED_RETENTION_AND_DELETION_NOTICE'
OCLR_BIND_HOST='APP_PRIVATE_IP'
PORT=3000
```

Use the real public domain for APP_URL and register **exactly** `https://YOUR_REAL_DOMAIN/auth/osu/callback` in your osu! OAuth application. ADMIN_OSU_IDS contains verified numeric IDs, not usernames. The privacy contact must be an approved global Admin; set the actual retention policy. OCLR_BIND_HOST is the Rocky host's own private IP, not Nginx's IP. Keep migration credentials out of this runtime file. Protect it and install the supplied DB CA:

```sh
sudo chown root:oclr /etc/oclr/runtime.env
sudo chmod 0640 /etc/oclr/runtime.env
sudo install -o root -g oclr -m 0640 /PATH/TO/PROVIDED_DB_CA.pem /etc/oclr/db-ca.pem
```

Keep `.env.local` and other local environment files out of release directories. The shell script never sources them; Next.js/Drizzle themselves can still load Next.js environment files. Do not paste secrets into Git, chat, command arguments or shell history.

**4. Back up and prepare the release.** Verify a recoverable backup of the intended external database first. Then open an unprivileged operator shell:

```sh
sudo -u oclr -H bash
cd /opt/oclr/releases/first
set -a
. /etc/oclr/runtime.env
set +a
bash scripts/production.sh setup --dry-run
read -r -s -p 'Migration database URL: ' MIGRATION_DATABASE_URL
printf '\n'
export MIGRATION_DATABASE_URL
bash scripts/production.sh setup --apply
unset MIGRATION_DATABASE_URL
exit
```

The hidden prompt takes the **migration** connection URL, with the same database/verified TLS settings as the runtime URL and its separate migration-role credentials. It is not written into shell history. Check each command succeeds; stop if setup reports an error. Setup installs locked dependencies, runs committed migrations with migration credentials, checks runtime configuration/schema and builds. Only the migration subprocess receives the privileged URL. Dry-run executes nothing and does not validate real credentials or connectivity. The npm aliases invoke the same Bash script.

These are preparation/start commands, **not completion of #10's deployment automation**. Setup requires explicit `--apply` after operator backup/target review. Automatic backup verification, serialization, migration drift detection, managed service switching/health rollback and two staging upgrades remain #10 work. There is no automatic legacy JSON import, account creation, publication or database rollback.

**5. Start under systemd.** For this fresh installation, point `current` at the prepared release and install the supplied unit:

```sh
sudo ln -s /opt/oclr/releases/first /opt/oclr/current
sudo install -o root -g root -m 0644 /opt/oclr/current/docs/examples/oclr.service /etc/systemd/system/oclr.service
sudo systemctl daemon-reload
sudo systemctl enable --now oclr
sudo systemctl status oclr
```

Adapt [oclr.service](examples/oclr.service) if your account/directories differ. It runs `/bin/bash scripts/production.sh start` and uses `/usr/local/bin:/usr/bin:/bin` to resolve Node/npm. Startup checks configuration/schema and executes Node directly; it never migrates/builds. Runtime credentials are already passed by systemd's EnvironmentFile. If startup fails, inspect `sudo journalctl -u oclr -n 100 --no-pager` privately; do not post unredacted logs.

**6. Configure your existing Nginx.** Follow [the separate-Nginx example below](#existing-separate-nginx-example-configuration). Allow inbound app-port access only from the actual Nginx source IP using your host/cloud firewall. Do not open port 3000 to the Internet. Keep SELinux enforcing.

**7. Verify from Nginx, then the browser.** From the Nginx host, replace both examples before running:

```sh
curl -I -H 'Host: YOUR_REAL_DOMAIN' http://APP_PRIVATE_IP:3000/
curl -I https://YOUR_REAL_DOMAIN/
```

Confirm the upstream is reachable and HTTPS has a valid certificate with no redirect loop. Then sign in through osu!, verify logout, check that ordinary accounts cannot access Admin, and rehearse registration/staff workflows in an isolated staging tournament. Never run destructive test fixtures against production. A browser request alone does not verify OAuth or database writes. This repository has not tested your actual Rocky/external DB/Nginx deployment.

During upgrades, build a separate release directory and switch the service only after setup succeeds; preserve the last verified release. Do not run npm ci/build inside the release currently serving users. Restrict inbound app-port access to the actual Nginx source IP with your host/cloud firewall. Keep SELinux enforcing; do not disable it to solve connectivity failures. This repository has not verified execution on the actual Rocky host.

## Existing separate PostgreSQL: deployment steps

Do **not** install/init a second database, upgrade the existing cluster, or overwrite an existing OCLR database. Confirm the actual server version, host/port, CA certificate, backup procedure and application-source IP with its administrator. PostgreSQL 17 is tested in CI; another version needs migration/staging verification. The names below describe a **new dedicated database**; for an existing installation, have its DBA adapt grants to the current object owner without recreating anything.

1. As the database administrator, create restricted login roles and a database. Use interactive psql password prompts; no passwords belong in SQL files or history:

```sql
CREATE ROLE oclr_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE oclr_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password oclr_migrator
\password oclr_runtime
CREATE DATABASE oclr OWNER oclr_migrator;
\connect oclr
REVOKE ALL ON DATABASE oclr FROM PUBLIC;
GRANT CONNECT ON DATABASE oclr TO oclr_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO oclr_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE oclr_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oclr_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE oclr_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO oclr_runtime;
```

2. Configure the **existing** database listener/TLS and pg_hba.conf to permit only the actual Rocky app/deployment IPs. A self-managed server may use `hostssl oclr oclr_runtime APP_IP/32 scram-sha-256` plus a corresponding restricted migration-role rule. Replace APP_IP; account for rule order and IPv6 where used. Do not introduce broad `trust` or `0.0.0.0/0` access. Managed database providers use equivalent access controls. See [PostgreSQL client authentication](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html).

3. Put the runtime connection in the app environment: `postgresql://oclr_runtime:ENCODED_PASSWORD@DB_HOST:5432/oclr?sslmode=verify-full&sslrootcert=/etc/oclr/db-ca.pem`. Replace every example value; URL-encode password characters, use the certificate's real host name, and install the trusted CA readably for the service. The migration connection uses the same verified server/database with oclr_migrator. Do not disable certificate validation. The existing [node-postgres connection-string parser](https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/README.md) supports sslrootcert; no second DB client is required.

4. Back up first, then run production:setup on the app release with the migration URL injected. Migrations create public application tables and the Drizzle migration ledger. Existing configurations and slugs are preserved; S11 stays unpublished on a fresh install. Only use the explicit legacy-import workflow above when required; subsequent deployments never overwrite database content from JSON.

5. For a database that already had objects before default grants, its DBA/actual object owner must also apply:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oclr_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oclr_runtime;
```

Run release preflight using runtime credentials, then rehearse sign-in, one synthetic staging registration and authorized staff work. Runtime must not be a superuser or have schema-creation/TRUNCATE privileges. Never point TEST_DATABASE_URL at this database. Keep encrypted backups and test restoration into an isolated target before release. On failure, stop writes and follow the existing rollback section; never automatically down-migrate or restore over new player data.

## Existing separate Nginx: example configuration

Copy and adapt [oclr-nginx.conf](examples/oclr-nginx.conf) **on the Nginx host**, not the app host. `192.0.2.20`, `oclr.example.com` and certificate filenames are documentation placeholders. Replace them with the Rocky application's private IP, actual canonical public domain and existing certificate paths. Set APP_URL=https://YOUR_REAL_DOMAIN and register the exact OAuth callback https://YOUR_REAL_DOMAIN/auth/osu/callback.

The example terminates HTTPS on the existing proxy and forwards to Node over a restricted private network. If that path crosses an untrusted network, use a verified encrypted tunnel or separately configured TLS upstream instead of plain HTTP. Host and forwarded protocol are set explicitly, which keeps canonical redirects, secure cookies and Origin validation consistent. The public browser's Origin header is preserved. Do not cache authenticated responses or OAuth callbacks; do not hide the application's CSP/no-store headers. Drafts use controlled polling; no WebSocket upgrade is needed. See official [proxy directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) and [TLS settings](https://nginx.org/en/docs/http/ngx_http_ssl_module.html).

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Run those commands only after adapting/installing the file and certificates; syntax and hosted traffic have not been verified here. Nginx must reach the app's private port, and the app must reach PostgreSQL; no Nginx-to-database connection is needed. If the existing Nginx host also uses SELinux, follow its approved proxy network policy (Rocky's [Nginx guidance](https://docs.rockylinux.org/it/guides/web/nginx-mainline/) documents httpd_can_network_connect); do not disable SELinux. Verify HTTPS, redirects, real-account OAuth login/logout, POST Origin checks, private cache behavior and draft polling on staging before declaring release ready.
