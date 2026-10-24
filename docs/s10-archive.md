# S10 historical archive and original rulebook (#161)

## Source and reproducibility

Organizer-provided [S10 workbook](https://docs.google.com/spreadsheets/d/12BGS8WRnl10OdeUKyvmOypFzpTYCpHgx9QY1mw-0hlw/edit) and [S10 rulebook](https://docs.google.com/document/d/1fcpt4x7gieT6n8lbK6nu0KIxlcGGVoloRKG0r1uGy0c/edit), captured on 2026-10-24 through their public XLSX/text/HTML exports.

- XLSX SHA-256: `154f22e7ce9175b17a31f0654a5515e884b302ab33da97557c9870cc3bf470c1`
- Original exported rulebook text SHA-256 (before BOM/CRLF normalization): `6aff9fb472041bd4d1bb40624b133e07ecbdf17323e7ea0b7ca219d2333fce12`
- Prepared browser import: [imports/s10-archive.json](imports/s10-archive.json).
- Original rules text: [imports/s10-rulebook.txt](imports/s10-rulebook.txt), with BOM removed, LF line endings and whitespace-only separators normalized. All nonempty lines remain literal.

```sh
python3 scripts/prepare-s10-archive.py /path/to/source.xlsx /path/to/s10-archive.json --captured-on 2026-10-24 --pool-conflicts stages
```

The standard-library extractor is read-only and has no network or database access. It reads cached public competition values and official profile hyperlinks. Reg and Reg List are excluded. The original XLSX is not committed because it contains other application data. The application never loads the source workbook.

## Reconciled records

| Source                            | Records                                          | Checks                                                                                                   |
| --------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Team rows 9–27                    | 10 teams, 80 players including 10 Captains       | Official osu! profile IDs, 8 members per team, Captain = Tier 0 and seven drafted tiers                  |
| Draft selections and final roster | 70 selections                                    | Seven rounds × 10 picks, validated against both Team and the final Draft summary                         |
| Staff B2:C16                      | 15 staff                                         | Literal historical roles only, no accounts or present-day grants                                         |
| GroupScore rows 6–15              | 10 standings, two groups                         | Four matches per team; all wins, losses and map totals independently reconcile against 20 group fixtures |
| Schedule rows 7–42                | 30 scored matches and six scoreless alternatives | All 30 results have MP URLs; real zero scores retained; dates retain source UTC+8                        |
| Mappools and Group stage mappool  | 5 pools, 97 slots                                | GS1/GS2/SF = 19 each, F/GF = 20 each; original titles and historical attributes                          |
| Landing and Stats                 | 8 external references                            | Forum, original rules, Discord and five statistics workbooks; no registration form                       |

Team order differs from Draft letters. Captain identity establishes the mapping, then all seven tier positions must match. Physical Team rows map to **D, J, E, F, A, C, H, I, B, G**, respectively. `koutya` in Draft is `koutya_` in Team (UID 14912108); captain and every other tier corroborate the mapping. Case-only `zkyler`/`Zkyler` and cached numeric names (`9898.0`, `232333.0`, `1611.0`) are normalized for comparison only. Team names and displayed usernames remain literal. No identity is inferred from the private registration list.

S10 has **no coaches**: the source rulebook explicitly says so, and no coach identities are listed. The source Free Agent area is empty. No S9 coach/free-agent records are copied.

Actual schedule dates span **2025-03-14 through 2025-05-10**, including the postponed final match 30. Landing's tentative opening on March 15 and April final dates do not override actual match timestamps. Display zone: `Etc/GMT-8` (UTC+8). VOD `https://b23.tv/S8iZ2WD` is retained literally; BV IDs become canonical Bilibili video URLs. Backslash placeholders are missing values, not staff names or replay links.

Rows **28a, 28b, 28c, 28d, 30a, 30b** have no scores or MP links. Retain them privately for review; the existing S9 public behavior omits scoreless records and their detail routes. Do not manufacture completed results from those alternatives.

## Mappool source priority

Apply the organizer's existing instruction **「以各階段獨立圖池表為準」**: GS1 uses `Group stage mappool` B4:N22; the other four stages only exist in `Mappools` and use their corresponding blocks. GS1 IDs agree across both sheets, but stars and some CS/AR/OD differ. Examples:

| GS1 slot         | Independent stage value used    | Combined value not used |
| ---------------- | ------------------------------- | ----------------------- |
| NM2 SR           | 6.29                            | 6.23319                 |
| NM3 SR           | 5.74                            | 5.84069                 |
| DT1 CS / AR / OD | 4.5 / 10.06666667 / 9.616666667 | 4.2 / 10.1 / 9.6        |
| FM2 CS           | 4.3                             | 3.7                     |
| TB1 CS           | 3.7                             | 4                       |

The script reports every override. Independent titles include mapper names in parentheses; preserve them verbatim. The explicit combined mapper field is used only after verifying that it matches the independent title suffix. No source stats are overwritten with live osu! API values. Drain fractions become seconds. Source set links are not mistaken for beatmap IDs. Existing S9-style archive cards, filters, sorting and detail dialogs are reused; without imported beatmapset IDs they retain the existing unavailable-cover fallback.

## Pool name correction (#261)

The organizer requested the five S10 pool names without the `// Bo… - … Bans` suffix. The prepared JSON and extractor now store `Group Stage 1`, `Group Stage 2`, `Semifinals`, `Finals` and `Grand Finals` directly. This is a name correction; historical match rules, bans, IDs, order and all 97 map slots retain their original values.

Migration `0036_s10_pool_names` updates existing completed `s10` archives in `edition_state.configuration.archive.pools`. It locks the edition row, keeps the first `//` prefix with surrounding whitespace removed, and atomically creates the next configuration revision plus an automatic `tournament_archive` audit event identifying the migration (no human actor is invented). Names without `//` and all earlier revisions remain untouched. Missing/already corrected archives are a no-op; an empty prefix or revision conflict fails without partial changes.

Apply this migration through the normal reviewed, backed-up deployment/update workflow in [deployment.md](deployment.md). No unpublish/reimport cycle is needed for an existing archive. A fresh S10 import uses the corrected JSON above. Shared schema parsing does not rename stored data; rolling application code back does not restore the old names or remove history. This repository change does not itself apply the migration to production.

## Original S10 thumbnail (#166)

`public/archive/s10/thumbnail.png` is the unchanged 1024×1024 transparent PNG embedded at Landing!C3 (gid=11421858), extracted from the captured XLSX's `xl/media/image1.png` through Landing's drawing relationship. SHA-256: `6a9fb71945c4b38e1d76c5e62292b85e4206b191970a9c0617e85b2a53db5f4d`. It retains the complete artwork and transparency; the spreadsheet's blue cell background is not part of the image.

After deployment, select **OCLR Season 10 — Square logo** in S10's General settings and save. This uses the existing revision-checked branding setting and public directory card. Background and key visual remain unchanged. Deployment does not overwrite existing edition configuration or select the asset automatically. No database migration is required; a rollback must keep support for the selected logo path, or clear that choice through the UI before rolling back.

## Original rules and public rendering

`src/content/s10-rulebook.json` contains seven literal chapters; `public/archive/s10/rules-{1,2}.png` contains the two original embedded diagrams (732×255 and 561×279). Both appear at their original paragraph anchors through the shared S11 `RulesHandbook` UI, with desktop/mobile contents.

The document specifies no version, so the UI shows the chapter count without inventing a version/date. `ti比赛信息：`, the old S8 group reference, duplicate item 5, the draft-order description and the warmup contradiction are preserved as authored. Actual picks are taken from the source Draft record rather than reconstructed from that prose. Neither original rules nor statistics links change live eligibility, draft configuration or award formulas.

Selection requires both the exact S10 workbook and S10 rulebook identities. S9 continues to use its own supplement; unrelated archives cannot inherit either rulebook merely by using a season slug. Public pages and saved previews omit source/provenance information; references remain in import review/payload only.

## Deployment and computer-use import handoff

This package is offline preparation. Deployment does not import or publish it. **Wait for the organizer's deployment confirmation**, then use computer use on https://oclr.org/ as requested for S9; never write through production APIs or the database.

1. Verify the deployed build and authorized Admin session. Check for an existing `s10` before creating anything; do not overwrite unrelated data.
2. Create/select private `s10`, name `OCLR Season 10`, season `10`, Completed, timezone `Etc/GMT-8`, no registration or S11 artwork. Suggested factual summary: `osu! Chinese League Rookie — Season 10. 2025 年歷史賽事歸檔。`
3. Upload/paste `s10-archive.json`, validate and review counts/source choices, then save the draft through the existing revision-checked import workflow.
4. Review all ten rosters, 70 picks, 15 staff, group standings, 30 scored matches, all five pools/97 slots, and seven rules chapters/two diagrams in the saved private preview. Source spelling, zero scores and March–May 2025 UTC+8 dates must remain intact.
5. Publish through the separate Publication action. Verify anonymously on desktop/mobile, historical directory order S10 before S9, edition-scoped links, hidden unplayed alternatives and no source display. Record actual evidence on #161; only then close the import issue.

No database migration, live result approval, registration acceptance, award recomputation or deployment is performed by this change. Existing authorization, revision locking, idempotency and transactional audit behavior are reused.
