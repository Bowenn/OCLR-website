# S8 historical archive and original rules (#164)

## Sources and reproducible preparation

Organizer-provided [S8 workbook](https://docs.google.com/spreadsheets/d/16ASDCD95p3TgfjgSHCjXmRN3KJuuAD4KS0fImpcTiiM/edit) and [S8 rulebook](https://docs.google.com/document/d/1Bcwl0HD9QVjl8P-Iq5nBqzPPlT-Oag-_IZjzNIfbjpI/edit), captured on 2026-10-24 via public XLSX/text/HTML exports.

| Export                                                   | SHA-256                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| Original XLSX                                            | `b2888af35a6620d402d476b5ea9e5d4c44756dee19da5fdf7951dac4c205e5bb` |
| Original rules text before BOM/line-ending normalization | `cdad9885f4a77543500b7c4db624b97b13148b3bfdbda995979a97e6df2d5186` |
| Rules HTML with embedded PNGs                            | `36a866eb201ea7555c5ce8a6f4388eeab86cfef9dca3d8f9bc9d803fecc4b128` |

The original workbook contains application/contact/comment data and is not committed. `scripts/prepare-s8-archive.py` allowlists both worksheets and exact competition columns/rows before extracting cells. Coach applications, Reg List, remaining unselected applicants, Park/Chess Time and exhibition games are excluded. Only Team's assigned coach identities are imported. The scripts make no network or database calls and do not execute source HTML or formulas. Cached external-sheet values are retained rather than pretending to recalculate them.

```sh
python3 scripts/prepare-s8-archive.py /path/to/s8.xlsx /path/to/s8-archive.json --captured-on 2026-10-24 --draft-results final-roster --pool-conflicts stages
python3 scripts/prepare-s8-rulebook.py /path/to/rules.txt /path/to/rules.html
```

Prepared import: [imports/s8-archive.json](imports/s8-archive.json). Original text evidence: [imports/s8-rulebook.txt](imports/s8-rulebook.txt). No automatic import or publication occurs on deployment.

## Coverage and decisions

| Source                                  | Prepared records              | Evidence and boundaries                                                                                                                                                    |
| --------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team G8:AT38, every second row          | 16 teams, 128 identities      | 112 playing members including 16 Captains; 16 assigned coaches. Original names and official numeric osu! profile IDs. Captain Tier 0, coaches without Tier, players T1–T6. |
| Pick Turn C2:H17 + Team Tier columns    | 96 final draft allocations    | Six rounds × 16, following the original captain order and final assigned player for each Tier.                                                                             |
| Schedule D5:Q42                         | 38 scored matches with MP IDs | 24 group fixtures and 14 knockout fixtures, original UTC+8 dates, available VODs, referees/streamers/commentators and separate red/blue bans.                              |
| GroupScore D3:H26 + group match scores  | 16 standings in four groups   | All three matches per team independently reconcile source wins/losses/maps won. Maps lost is summed from recorded scores.                                                  |
| All Mappools + Current Mappool GF block | Four pools, 76 slots          | GS/SF/F/GF, 19 positions each; no live metadata or guessed beatmap IDs.                                                                                                    |
| Landing N10/N12 + Stat List C3/C5/C7/C9 | Six reference links           | Original rulebook, Challonge and four statistical workbooks. Reference fields are not displayed on public pages.                                                           |

On 2026-10-24 the organizer explicitly selected **「依最終名單與原表順序整理」** for S8's draft results. Pick Turn contains captain order, not a timestamped player-pick log. Team supplies final Tier allocations. These are displayed as final draft results, without claiming to reconstruct selections before any same-Tier trades. Both references remain in each pick's source evidence. The script requires the explicit `--draft-results final-roster` mode.

Technical team keys use `team-{captain osu! ID}` because this source has no authoritative team-letter identifiers. Display names remain literal. No raw applications become accepted registrations, current accounts, staff permissions or native live teams.

**Unknown standings ranks:** GroupScore does not contain a numeric rank column. Preserve its row order without inventing ranks or tie-breaks, particularly the three 1–2 teams in Group B. The archive schema accepts explicit `rank: null`; the shared standings table renders the existing localized “Not recorded” label. S9/S10's recorded numeric ranks remain unchanged. The generated bracket still groups each of A/B/C/D's six recorded fixtures and connects recorded knockout appearances; it does not invent advancement rules.

**Staff:** The source has no separate staff identity/role table. `staff` stays empty, and the staff page reports “Not recorded.” Per-match referee, streamer and commentator names remain literal. Do not guess UIDs or role assignments from names or import coach applications as staff. A later organizer-provided staff source can supplement the archive.

## Dates, results and pool details

- Actual Schedule dates are **2023-02-25 through 2023-04-09**, including the delayed grand final. Source `Time(UTC +8)` becomes offset timestamps; use edition zone `Etc/GMT-8` for fixed UTC+8 display. Tentative Landing month/day ranges do not override actual dates or become invented registration timestamps.
- All 38 matches have a score and numeric MP ID, converted to canonical `https://osu.ppy.sh/community/matches/{id}` URLs. No scoreless alternatives occur in this package.
- **Schedule O22** contains `107330020`, the same match's MP ID, rather than a valid BV video ID. Its `vodUrl` is null; score and MP URL remain intact. O15/O42 also lack VODs. The other **35** valid BV values become canonical Bilibili URLs. Do not synthesize a replay for the invalid numeric value.
- P's combined bans use `丨` as the red/blue separator. Split only that exact delimiter, retaining each side's literal content. Missing bans/commentary remain null.
- Apply the existing organizer policy of independent-stage priority: GF uses `Current Mappool` E9:S27; the other three pools use `All Mappools` E9:S27, E36:S54 and E63:S81. The GF block matches All Mappools E92:S110 field by field, despite differing summary averages. Do not import the averages. No FM slots occur; four pools retain all historical stats and drain seconds.
- Current Mappool's Show Match 1/2 pools and the separate Showmatch worksheet are exhibition material, outside the 16-team main competition. They are not counted as additional scored championship matches/pools.
- No per-game statistics, awards or present-day result approvals are inferred from aggregate scores. No live API stats overwrite historical values. Existing S9/S10 archive cards, filters, UID avatars, search and edition links are reused.

## S8 original rulebook

`src/content/s8-rulebook.json` preserves seven chapters and four original PNGs in `public/archive/s8`: the decorative RULES banner (750×110), draft diagram (732×255), BP diagram (561×279) and wrong-pick example (542×140). The banner appears before the chapters inside the shared handbook's reading column; the other images retain their original text anchors. The document's standalone leading `=` is retained in textual evidence/title metadata rather than presented as a chapter. No version/date is specified, so none is invented.

Original BWS, coaches, no-FM/allowed-NM-Mod rules, EX rules, duplicate numbering, the draft-order explanation and warmup contradiction are retained as authored. They do not change current edition configuration, draft eligibility or award calculations. The original Google account-index rulebook URL (`/document/u/0/d/.../edit`) is recognized as the same document identity as the organizer's canonical URL. Selection still requires both the correct S8 workbook and document ID; S9/S10 cannot inherit S8 content.

## Deployment and later computer-use import

**Wait for the organizer to deploy and confirm before production import.** Then use computer use at https://oclr.org/, following the S9/S10 workflow. Never use direct production API/DB writes.

1. Verify deployed content and authorized Admin session, and check whether `s8` already exists. Do not overwrite unrelated data.
2. Create/select private slug `s8`, name `OCLR Season 8`, season `8`, Completed, timezone `Etc/GMT-8`, no registration configuration or S11 artwork. Suggested factual summary: `osu! Chinese League Rookie — Season 8. 2023 年歷史賽事歸檔。`
3. Upload/paste the prepared package, validate and review, then save through the existing revision-checked importer. Counts: 16 teams, 128 identities, 96 final draft allocations, 38 results, zero incomplete fixtures, 4 pools/76 slots; no separate staff identities.
4. Review all 16 rosters, coaches/Captains/Tiers, six draft rounds, four group tables with unknown ranks, actual dates, MP/VOD handling, all pool stages and seven rules chapters/four images in the private preview.
5. Publish through the separate Publication action. Verify anonymously on desktop/mobile, directory order S10/S9/S8, search, generated bracket, no provenance display and correct edition links. Record actual evidence on #164 and close only after production import acceptance.

No database migration is needed. **Deploy support for nullable historical ranks before importing this S8 package.** Earlier builds that require numeric archive ranks cannot parse this edition after import; rollback must retain compatible archive support rather than erasing archive revisions or audit history. Publication, Admin scoping, revision locks, idempotency and transactional audit behavior remain unchanged.
