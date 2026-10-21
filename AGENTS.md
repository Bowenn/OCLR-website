<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OCLR working instructions

- Official name: **osu! Chinese League Rookie (OCLR)**. Extend the existing Next.js/TypeScript/PostgreSQL/Drizzle application; reuse working services and UI. No new frameworks, generic tournament platform or speculative rules.
- GitHub Issues are the backlog. Inspect the requested issues and latest remote before editing. Preserve user changes and local environment files. Commit each issue separately and push automatically; verify the remote SHA and update the issue. Never force-push, bypass protection or open a PR unless requested.
- Current organizer preference: implement the requested issue batch, then run combined verification. Do not repeat the whole suite after every small issue. Rerun affected checks after fixing failures; only close issues once their acceptance is verified.
- Use an isolated PostgreSQL database explicitly named for testing. Set `TEST_DATABASE_URL`; never run destructive fixtures against the demo or production database. Check lint/types, unit/integration tests, production build, desktop/mobile Playwright and production dependency audit for a completed batch. CI remains authoritative.
- Never read, print or commit `.env.local`, OAuth credentials, provider tokens or database passwords. Use `.env.example` for configuration names. Do not change the user's demo process or production services without a request.
- Admin, Mappooler, Referee and Captain permissions remain server-enforced and edition-scoped. Audit writes are automatic and transactional; no routine Audit Reason fields. Preserve version checks, uniqueness, concurrency and idempotency.
- Public tournament directories include every accepted registration's minimal identity. Pending/rejected/withdrawn applications, answers and notes remain private. Captain/team/roster metadata requires its own release. Keep directory/profile navigation in the selected edition.
- Unlocked public mappool/fixture edits stay public. Completed-fixture pool locks and approved structural fixture history remain protected. Draft picks/transitions publish authoritative snapshots atomically after explicit session release. Results use reviewed submission → Admin Approve & publish; never publish imports directly.
- Deployment target: **Rocky Linux 10**, with systemd, **existing separate PostgreSQL** and **existing separate Nginx**. Do not install or initialize replacement database/proxy services. Follow the Rocky-specific section in docs/deployment.md; never disable SELinux or expose the Node listener unnecessarily.
- Production entry point is Bash (`scripts/production.sh`), with npm aliases. Preserve explicit exported-environment configuration, migration-secret isolation, fail-closed setup and direct Node exec for systemd signals.
- Production preparation: `npm run production:setup -- --dry-run`, then setup only on the intended host after approved environment configuration and backup. `npm run production:start` serves a prebuilt release without migration. See README and docs/deployment.md. Do not claim real deployment/live OAuth or organizer rehearsal passed unless performed. No assumed domain or credentials.
- Routine updates use `scripts/update.sh --ref FULL_REVIEWED_COMMIT_SHA --apply` from a clean operator checkout, with single-host locking, a new release directory, verified backup, migration history/target checks, systemd switching and exact-release local/public health. Preserve its fail-closed recovery and secret isolation. Never build over the serving release or automatically restore/down-migrate a live DB.
- #10 remains open: setup/start are preparation commands, with explicit `--apply` for setup. Local isolated backup/migration and simulated service tests do not replace two complete persisted staging upgrades or actual Rocky/TLS/OAuth/organizer rehearsal. Follow docs/deployment.md and report those external gates accurately.
- After completing the current #64–#71 section and requested production-script/handoff work, **pause**. Do not begin another issue or deploy until the organizer asks to resume. Report the checkpoint and any remaining external gates honestly.
