# OCLR — osu! Chinese League Rookie

Official community tournament website for **osu! Chinese League Rookie (OCLR)**. OCLR is a community event and is not affiliated with or endorsed by osu!.

This Next.js application supports individual tournament registration, staff-managed competition setup, captain-led team drafting, released mappools, fixtures/results and public tournament pages. PostgreSQL is the source of truth for tournament and account data.

## Quick start

Use **Node.js 24 LTS** (minimum supported version: 22.13) and npm. Start a local PostgreSQL database and configure the required settings in a private environment file:

```sh
npm ci
cp .env.example .env.local
# Configure DATABASE_URL and any credentials needed for the features you are testing.
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Authentication and registration require valid osu! OAuth, admin/privacy configuration and PostgreSQL. Never commit secrets or production data. See the [development guide](docs/development.md) for setup, testing and environment details.

## Checks

```sh
npm run check      # ESLint and TypeScript
npm run build      # Production build
npm run test:i18n  # Localization checks
```

Database-backed tests require an explicitly configured, **isolated** `TEST_DATABASE_URL` (database name containing `test`). See [development](docs/development.md) for unit/integration and browser test prerequisites.

## Documentation

- [Documentation index](docs/README.md) — all guides and design references
- [Development](docs/development.md) — local setup, checks, OAuth, PostgreSQL and design notes
- [Tournament administration](docs/tournament-management.md) — editions, registration, staff roles and audits
- [Competition workflows](docs/competition-operations.md) — captains, teams, drafting, fixtures and results
- [Mappools](docs/mappools.md) — beatmap metadata, mod slots, publication and editing
- [Public features](docs/public-features.md) — news, player directory/profiles, standings and public views
- [Localization](docs/localization.md) — English, Simplified/Traditional Chinese and appearance
- [Deployment and operations](docs/deployment.md) — Rocky Linux, production updates, migrations, backups and recovery

## Production deployment

Use the reviewed [production deployment runbook](docs/deployment.md) before deploying or updating a live site. On the documented Rocky Linux host, the entry points are `sudo bash scripts/oclr.sh deploy` for first installation and `sudo oclr update` for subsequent releases. Production upgrades must follow the runbook's **backup → pending migrations → release activation → health check** sequence; never use development schema push or test fixtures against production.

Use `sudo oclr cleanup` to preview old release cleanup, then `sudo oclr cleanup --apply` to remove eligible versions. The newest 3 releases and the `current`/`previous` targets are retained. See the runbook for retention options and upgrading the installed command.

Artwork and tournament dates shown in [design references](docs/design/) are examples, not approved competition data.
