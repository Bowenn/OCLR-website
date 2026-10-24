# OCLR documentation

The repository root [README](../README.md) contains only a project overview, a quick start and common commands. Detailed technical and operational material is organized here by responsibility.

| Guide | Contents |
| --- | --- |
| [Development](development.md) | Local setup, checks, authentication, PostgreSQL, design notes |
| [Tournament administration](tournament-management.md) | Edition settings, registration lifecycle, roles, staff reviews and audits |
| [Competition workflows](competition-operations.md) | Captains, teams, draft engine, fixtures, multiplayer import and result review |
| [Mappools](mappools.md) | Beatmap metadata, slot/order management, public Mappools and publication rules |
| [Public features](public-features.md) | News, About, players, published profiles, bracket and standings |
| [Localization and appearance](localization.md) | Locale messages, Simplified/Traditional Chinese and appearance preferences |
| [Deployment and operations](deployment.md) | Host setup, release scripts, database migrations, backup and rollback |
| [Design references](design/) | Artwork and UI references (illustrative only) |
| [Appearance design backlog](design/appearance-backlog/README.md) | Unimplemented reference styles, P3 issues, extracted CSS and detailed MainSheet design notes |

**Where to start:** use [Development](development.md) to work locally, [Tournament administration](tournament-management.md) to understand enrollment and permissions, and [Deployment](deployment.md) for running or updating production. Never use production credentials or personal registration records in tests.
