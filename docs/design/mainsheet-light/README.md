# MainSheet Light public tournament UI reference

Reference supplied by the organizer from `mainsheet-light` on 2026-10-21. `DESIGN.md` and the selected screenshots are preserved from that reference; they describe the prototype, not implemented application behavior or verified OCLR facts.

The proposed direction is a light lavender public tournament site with purple/pink accents, official S11 artwork, horizontal section navigation and compact competition information. The existing Admin, private Player/Captain workspaces and OBS overlay remain outside this visual change.

**Data boundary:** screenshots contain S8 sample teams, dates, scores, standings and example rules under S11 preview branding. Never seed or publish these as real S11 data. Use the existing database-backed editions, approved results, released mappools and published team/roster queries. The tournament name remains **osu! Chinese League Rookie (OCLR)**.

- [Original design notes](DESIGN.md)
- [Overview, desktop](preview/page-overview-1440.png) / [mobile](preview/page-overview-390.png)
- [Schedule, desktop](preview/page-schedule-1440.png) / [mobile](preview/page-schedule-390.png) / [compact view](preview/state-schedule-compact-1440.png)
- [Mappools, desktop](preview/page-mappool-1440.png) / [mobile](preview/page-mappool-390.png) / [mobile detail drawer](preview/state-map-drawer-390.png)
- [Teams, desktop](preview/page-teams-1440.png) / [mobile](preview/page-teams-390.png)
- [Rules, desktop](preview/page-rules-1440.png) / [mobile](preview/page-rules-390.png)
- [Mobile navigation](preview/state-menu-390.png)

The standalone prototype JavaScript, embedded fonts and example data are intentionally not application sources. Implement within the existing Next.js components and real routes. Retain useful compact views and supported destinations even when they are not represented in the prototype. Verify font licensing before adding font assets; readable text, contrast and touch targets take priority over copying tiny screenshot labels.

Implementation tracking: [UI epic #73](https://github.com/PhoenixEmik/OCLR-website/issues/73); localization coordination remains in [#72](https://github.com/PhoenixEmik/OCLR-website/issues/72).
