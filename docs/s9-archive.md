# S9 historical archive: analysis and import handoff (#145)

## Source and extraction

Organizer-supplied [S9 workbook](https://docs.google.com/spreadsheets/d/11PwNlEsUFb6f3VCY2-sdGlPysP0ukihN8_lE4DGuzfA/edit), downloaded as XLSX on 2026-10-23. Source SHA-256: `97db8001ab01b3da9183c87645e5d55f227d1b21ebf8b98e400f68a7dcc2f9af`. The source has 29 worksheets, including 4 hidden worksheets. Google `IMPORTRANGE` exports contain cached values and compatibility formulas; this analysis reads the exported values and links without pretending to recalculate external workbooks.

The original workbook is **not** committed: it also contains contact information, application answers, personal descriptions, staff comments, predictions and chat. The allowlisted extractor reads only competition columns. No source workbook is loaded by the application.

Prepared browser-import package: [imports/s9-archive.json](imports/s9-archive.json). This is a reviewed-input candidate, not a runtime seed or migration. Nothing is automatically imported or published on deployment.

```sh
python3 scripts/prepare-s9-archive.py /path/to/source.xlsx /path/to/s9-archive.json --captured-on 2026-10-23 --pool-conflicts stages
```

The script uses Python's standard library, makes no network/database calls, retains source references, verifies unique identities and reconciles group standings. Optional `--pool-conflicts stages|all` must only be used after an explicit organizer source decision. The default keeps conflicting fields null.

On 2026-10-23, the organizer explicitly selected **each stage's individual mappool worksheet** as authoritative (「以各階段獨立圖池表為準」). The prepared package therefore uses `--pool-conflicts stages`; All Mappools remains a comparison reference, not the deciding source.

## Verified coverage

| Source                    | Prepared records                          | Mapping                                                                                                   |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Team!G9:AZ23              | 8 teams; 64 playing members and 8 coaches | Stable numeric osu! IDs from profile links, original names; captain = internal Tier 0 / literal `Captain` |
| Draft!A2:O9               | 56 selections                             | Seven rounds × eight selections, checked against Team; round N = Tier N                                   |
| Draft!R2:R5               | 4 free agents                             | Separate role, no invented team or Tier                                                                   |
| Staff!B2:C20              | 19 historical staff                       | Attribution only; no accounts or permissions                                                              |
| Schedule!D7:R34           | 28 schedule records                       | 22 with scores, MP and replay IDs; six with missing outcomes                                              |
| GroupScore!D6:L13         | 8 standings in 2 groups                   | Ranks retained from source; wins/losses/map totals independently match all 12 scored group fixtures       |
| GS/SF/F/GF Mappool!D7:S26 | 4 pools, 19 positions each                | Slot, beatmap ID, title, mapper and historical attributes; no live API overwrite                          |
| Landing / Stats           | 7 reference links                         | Rules, bracket, draft broadcast and four stage statistics workbooks                                       |

There are **76 unique roster/free-agent identities**: 64 players (including eight captains), eight coaches and four free agents. The raw Reg List has 92 entries and its filtered result shows 68. A raw application is not evidence of acceptance. The package therefore uses Team/Draft identities, rather than creating 92 accepted registrations or invented consent records. Historical names can differ between MRA and team sheets; joins use osu! IDs, while the selected source spelling stays literal.

Dates in Schedule are Excel dates from **2023-11-04 through 2023-12-10**. The column explicitly states UTC+8. They are converted to offset timestamps with that offset, retaining the scheduled instant. Landing's month/day milestones have no explicit year or exact start/end times and are not turned into invented registration timestamps. Use `Etc/GMT-8` as the edition display zone (fixed UTC+8, no inferred location).

## Source decisions, unresolved and excluded data

- Schedule rows **20A, 20B, 20C, 20D, 22A, 22B** contain pairings/times without scores or MP links. These remain unconfirmed schedule alternatives; they are excluded from the results page. No cancellation, completion, winner or bracket progression is inferred.
- **GS TB1** conflicts between GS Mappool row 26 and All Mappools row 26: ID **1751858 / 3928422**, mapper **Nathan / AJT**, and different SR/BPM/drain/CS/OD. Per the organizer's source decision, the package uses GS Mappool: **1751858**, **Nathan**, SR **5.60014**, BPM **200**, Drain **303 seconds**, CS **4**, OD **8.2**.
- **SF NM6 SR** is **5.72796 / 5.66546** (SF Mappool!K13 / All Mappools!K39). **GF NM1 SR** is **6.54139 / 6.47448** (GF Mappool!K8 / All Mappools!K86). The package uses the individual stage values **5.72796** and **6.54139**, respectively. Other tiny numeric serialization differences are compared with a tolerance of 1e-8; IDs/counts are exact.
- The pool sheets' summary averages are not imported. The 76 slot records are not counted twice from All Mappools. Attributes are historical values that may already include Mods; Drain is stored/displayed in seconds.
- `#REF!` values occur in avatar/flag cells and Weekly Awards. They are not images, countries or award outcomes. No flags are inferred from names. Weekly Awards and current award formulas are not applied to S9.
- Detailed game scores/MRA are not included in this source workbook's match table. Stage statistics and rules remain traceable external references. No per-game results are synthesized from aggregate scores or attributed to present-day Admin approvals.
- No registration answers, contact details, comments, predictions, chat or current OAuth accounts/role grants are imported.

## Implemented workflow

`/admin/tournaments/[edition]/archive` accepts a JSON file or pasted JSON, validates the full strict schema and edition slug, shows counts/source notes/all fields, and saves only after confirmation. The server independently validates, enforces edition-scoped Admin authorization, locks the edition row, checks its configuration revision, and uses the existing transactional edition revision/audit stream. Repeating identical data at the current revision is a no-op; a stale concurrent request is rejected.

Import requires a private, completed edition with no registration configuration and no existing operational registrations/teams/draft/stages. Native setup commands share that lock and reject archive editions. Archive imports never create users, applications, staff grants, live draft sessions or approved result records. No new framework, provider credential or database schema is required.

Private saved preview: `/admin/tournaments/[edition]/archive/preview`. Public pages continue to use the existing edition routes and navigation: overview, teams and member details, players, schedule, match details, results, pools and pool details, standings and draft results. All public reads require edition publication. Unknown IDs return 404. Internal links stay within the selected edition; MP and replay links remain available. Historical results remain separate from approved live results.

Historical mappools open directly on the first stage, with deep-linked stage navigation, keyboard-accessible Mod filters and title/mapper/slot/ID search. Compact rows preserve source order and full original titles; recorded SR/BPM/CS/AR/OD are rounded only for display (raw values remain available as tooltips), and drain seconds use m:ss. Missing values stay unknown. Source references, source links and provenance notes are omitted from public pages and saved private previews; they remain in the archive payload and import review. Live osu! metadata is not fetched to replace historical statistics. Private preview links remain private.

Historical schedule and results now share one workspace with status/stage filters; the old results URL redirects to its recorded-results view. UID avatars identify players, Captain and Coach have distinct roster badges, and draft picks are grouped by round. The generated bracket connects teams’ previous recorded appearances in chronological columns, without claiming qualification rules; unconfirmed alternatives are excluded, group matches and source standings remain separate.

Historical staff have a dedicated `/tournaments/[edition]/staff` page, linked from edition navigation and the archive overview. It reads the imported `archive.staff` records, groups by the original position in recorded order, and shows historical names with UID avatars and osu! profile links. The same view supports the authorized private archive preview. Public access requires a published archive; ordinary editions do not expose this route. Historical staff listings never create current staff grants. S9's existing 19 records need no reimport.

The tournament directory groups current/upcoming tournaments separately from completed historical seasons, sorting seasons numerically in descending order. Existing current-tournament navigation is preserved. All three interface locales and default/pastel/Swiss designs share ordinary light/dark tokens; broadcast routes are unchanged.

## Deployment and later computer-use import

Development and the offline package are ready independently of production data. **Wait for the organizer to deploy and confirm before importing on https://oclr.org/**. The requested production import must use computer use through the website, not direct API/database calls.

1. Verify the deployed build and sign in as an authorized Admin using the normal website flow.
2. Check for an existing S9 edition before creating anything. Do not overwrite unrelated existing records. Create/select slug `s9`, name `OCLR Season 9`, season `9`, status Completed, zone `Etc/GMT-8`, no registration, no S11 artwork. Suggested factual summary for organizer review: `osu! Chinese League Rookie — Season 9. 2023 年歷史賽事歸檔。`
3. Keep it private. Open Historical archive, choose/paste `s9-archive.json`, validate and inspect the source notes/counts. Verify the package reflects the organizer-approved individual stage worksheets, including GS TB1 1751858, SF NM6 SR 5.72796 and GF NM1 SR 6.54139.
4. Save draft. Inspect overview, all eight team rosters, draft, standings, the 22 scored/6 unconfirmed matches and all four pool details in the saved private preview. Confirm original names and UTC+8 dates.
5. Use the separate tournament Publication action to publish the reviewed archive. Verify anonymously from Tournaments → Historical seasons, plus direct detail URLs and mobile navigation. Record actual imported scope, remaining gaps and production verification on #145; only then close the issue.

Do not claim production import, deployment or verification has occurred before these steps are actually performed. New Chinese archive-interface wording and the package's explanatory notes should be reviewed by the organizer before publication, consistent with the existing wording policy.

There is no new migration for #145. Once an archive is saved, its optional `archive` configuration field is present in edition JSON and immutable configuration revisions. Earlier strict application schemas do not understand that field. Application rollback must retain a build that supports it; do not erase archive/audit history or rewrite configuration just to run an incompatible older build.
