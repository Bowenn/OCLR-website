# S6 surviving historical sources (#289)

The organizer supplied `OsuChineseLeagueR Season6 MainSheet.xlsx` and the original
S6 key visual in the [#289](https://github.com/OCLR-dev/OCLR-website/issues/289)
preparation chat on 2026-10-25. This is **OCLR S6**, not β/S5. The issue URL is the
provenance entry point, not a claim that the workbook is downloadable there.

This phase organizes surviving evidence only. There has been no production
import, publication, deployment, database change or edition creation. The issue
remains open. Missing knockout results and final placements remain unknown.

The organizer then supplied [OCLR Mappool Collections](https://docs.google.com/spreadsheets/d/14o3t0nEwp5YnRZHbjgX8OBr9tj7yeajzV5FlVIZM0Vg/edit)
and selected **S6GS, S6ES and S6FS** only. The organizer reiterated that match
results are lost. Other seasons in that collection are outside this task.

## Files and reproducibility

- [Structured source review](imports/s6-source-records.json): `importReady: false`.
  This deliberately differs from the historical archive schema and **must not
  be uploaded to the archive importer**.
- [Preparation script](../scripts/prepare-s6-source.py): Python standard library
  only, no network requests, database writes or formula execution.
- [Supplementary pool snapshot](imports/s6-pool-source-snapshot.json): bounded
  native Sheets reads of B4:J70, plus empty Map ID tails J71:J1000 for each S6
  tab. Sheet IDs: GS **405667568**, ES **1310799675**, FS **1503362078**.
- [Original S6 key visual](../public/archive/s6/key-visual.jpg): unchanged JPEG,
  1920 × 1080. It has been collected as an asset; edition branding choices and
  automatic archive artwork mappings are not changed in this phase.

Workbook SHA-256:
`63a4926e5077d4ae46721de60349025ef44c8be70c3c88fe9c5b38f1af312a75`.
Artwork SHA-256:
`3f40ae9a494ef7b349229e45c016c0e8fb82719b125bd4c407cd121099e720b7`.

The workbook contains personal application material and is **not committed**.
The script reads an explicit competition-cell allowlist and only C:D identity
pairs from 测试表. It exports only identities referenced by the surviving roster
or staff signatures. Application fields, contact information, biographies,
discussions, comments, obsolete rosters, cost evaluations, unrelated lookup
identities, suggester and showcase signatures are excluded. Embedded images,
hyperlinks and instructions in the workbook are not executed or followed.

```sh
python3 scripts/prepare-s6-source.py /path/to/source.xlsx \
  docs/imports/s6-source-records.json --captured-on 2026-10-25 \
  --pool-snapshot docs/imports/s6-pool-source-snapshot.json
```

## Surviving coverage

| Source                          | Preserved evidence                                                                                                                     | Limits                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 队伍表 A3:J47, every fourth row | 12 teams in A–L source order, 84 roster slots: 12 Captain, 12 VICE, 12 coach, 48 Tier 1–4 slots                                        | Only B/E/K have authored team names. Other names stay null. Full-width Ｋ stays in `sourceLabel`, while the reference key is `team-k`. Cost/Points do not establish results or ranking.                    |
| 测试表 C1:D74                   | 70 roster slots resolve to UIDs, including the two organizer-confirmed aliases; K Tier 4 replacement history supplies two further UIDs | 72 evidenced people, 13 people without a confirmed UID. The replacement occupies one source slot, so 14 slots have a null direct UID. No fuzzy matching or cross-season name matching is performed.        |
| 对阵表 A2:L7                    | Six first-round schedules on 2021-05-08/09, 18:00/19:30/21:00, organizer-confirmed UTC+8                                               | All six lack scores, MP IDs, VODs and match staff. They are scheduled evidence, not completed results. No group membership, W/L totals or bracket progression is inferred from six pairings.               |
| 对阵表 A8:A35                   | 28 template labels retained separately for review                                                                                      | No participants or results. They are not fixtures or knockout evidence.                                                                                                                                    |
| 小组赛图池 B2:L24               | 19 maps: NM1–6, HD1–4, HR1–4, DT1–4, TB                                                                                                | Title, mapper, BID, source SR/BPM and parsed drain seconds retained. TB becomes canonical TB1 with `sourceSlot: "TB"`. CS/AR/OD are unknown.                                                               |
| 队长资格赛赛图 B2:L34 (hidden)  | Seven actual maps: NM1–3, HD1, HR1, DT1–2                                                                                              | Blank and `#N/A` templates excluded. Column C contains stale/template IDs; actual BIDs come from J. This is review evidence, not an instruction to publish a hidden sheet.                                 |
| 教练赛赛图 A2:G8 (hidden)       | Seven actual maps: NM1–3, HD, HR, DT1–2                                                                                                | HD/HR get canonical HD1/HR1 while literal source slots remain recorded. Source SR/BPM retained without applying DT again. Drain/CS/AR/OD are unknown.                                                      |
| 教练资格赛 A2:N16 (hidden)      | 15 score rows, 105 raw per-map scores                                                                                                  | Cached RANK/SUM values of zero are discarded. No qualifier placement or tournament final placement is calculated.                                                                                          |
| 队长资格赛 A2:N6 (hidden)       | Five names, four with scores (28 per-map values); Azureus has no scores                                                                | Missing scores remain an empty object, not zero scores or a forfeiture.                                                                                                                                    |
| Cover G7:K11                    | Five signatures: Hosts Explosive/Prophet, Referee Sonoaoi, Streamer Sonoaoi, LOGO Inspired Selis                                       | Sonoaoi/Selis have workbook UIDs. Explosive/Prophet stay name-only in this source-only phase. Blank Mappool/Commentary columns do not establish contributors. No current roles or permissions are granted. |
| Cover B21:E22                   | Registration/coach-Captain event: May 3; draft: May 5; first group round: May 8, all 2021                                              | Calendar milestones only. No pick sequence or rulebook was supplied.                                                                                                                                       |

The workbook supplies three pools with **33 maps**. The supplementary S6GS
slot/ID pairs exactly corroborate its 19 group-stage maps and do not create a
duplicate pool. S6ES and S6FS add 19 maps each, giving **five distinct pools and
71 map entries**, including the two qualifier pools. All three stage pools have
NM1–6, HD1–4, HR1–4, DT1–4 and TB. ES begins with BID **2277760** and ends with
TB **2968871**; FS begins with BID **2733463** and ends with TB **2510638**.

The supplementary Google Sheet uses live IMPORTHTML/IMPORTDATA formulas. At
capture, title/statistic cells were loading or unavailable; some difficulty
names were readable formula results. The snapshot preserves those observations
and error types separately. ES/FS historical title, mapper, SR/BPM/drain and
CS/AR/OD remain null in the review dataset. No current metadata is substituted
for historical values. The GS workbook statistics remain unchanged. A mismatch
between the two GS slot/ID sources makes regeneration fail instead of overwriting.
The collection's Google timezone setting does not override the organizer's
explicit UTC+8 schedule confirmation.

The original artwork is collected independently; it does not supply rules,
results or missing identities.

## Organizer confirmations (2026-10-25)

The organizer explicitly confirmed the following in this chat after reviewing
the source questions. These are recorded separately in the JSON and script:

1. 队伍表 I27 `Inverse Lu Yang` is 测试表 C40:D40 `lnverse Lu Yang`, UID **3753204**.
2. 队伍表 G19 `Re_CYCLE` is 测试表 C74:D74 `re_cyclc`, UID **9043058**.
3. 队伍表 J43 `Name-Less-` / `PhantoMPainN` is a replacement history, not two
   simultaneous members. The lookup supplies **8425774** and **14947596**
   respectively (`PhantoMPaiN` in C65:D65). Preserve the roster spelling and both
   identities in `replacementHistory`. No replacement date, match eligibility,
   or present membership is inferred.
4. Schedule timestamps use **UTC+8**, represented as `Etc/GMT-8` and `+08:00`.

Numeric `970.0` is displayed as the username `970`; it is never UID 970. VICE is
retained as a source role with no inferred Tier. Final Tier columns are not a
chronological draft log.

## Remaining gaps and import handoff

| Source                 | Unconfirmed identity                             |
| ---------------------- | ------------------------------------------------ |
| 队伍表 D47             | Captain Fushimi Rio                              |
| 队伍表 F3/F7/F11/F15   | Coaches Neina, Kishin Sagume, Michka, 970        |
| 队伍表 F19/F23/F27/F31 | Coaches wdwdwww, [Crz]Makii, Kazumi Pager, Old K |
| 队伍表 F35/F39/F43/F47 | Coaches CUWAN, Miracle, Kotor1, Crystal          |

These are missing **from the exact-name identity evidence used in this phase**,
not claims that the people have no account. A similarly named public account is
insufficient: for example, the search result `- Fushimi Rio -` must not be silently
substituted for Captain `Fushimi Rio`. Public lookup attempts did not establish
the missing Captain identity, and no such candidate UID is included.

Before a future import:

1. Obtain a reliable Captain UID for L and reviewed evidence for other missing
   identities, or explicitly design support for unknown historical identities.
2. Decide how to preserve VICE and dated/undated roster replacements. The current
   importer requires one numeric-UID Captain per team and has no VICE or
   replacement-history representation. Do not flatten the replacement pair into
   two simultaneous players or omit the whole L team merely to pass validation.
3. Decide publication scope for the hidden qualifier evidence. Preserve raw
   scores separately from head-to-head match results and unknown final rankings.
4. Produce a separately validated archive package using the existing services
   and review flow, with no speculative results, standings, picks or rules.
   The current schema also requires map titles, so ES/FS metadata needs reliable
   evidence or compatible unknown-title support before import.
5. After compatible code is deployed and the organizer authorizes the action,
   inspect any existing `s6` edition, save a private draft through the existing
   administrator UI, review it, then publish separately if authorized. Do not
   overwrite unrelated data or write directly to production DB/API.

## Verification

This phase changes source material, its preparation script, source checks and an
unchanged artwork asset. Application services, UI, contracts and database schema
are unchanged. Checks and actual CI state are recorded on #289; source review
does not establish importer compatibility, production acceptance or deployment.

Verified locally on 2026-10-25 with Node.js 24.19.0: `npm ci --include=dev`,
`npm run check`, 39 tests across the S6 source and existing historical archive
unit checks, three Python extraction/privacy/conflict tests, semantic regeneration
equality, local documentation links, unchanged JPEG hash/dimensions and
`git diff --check`. Full application build, DB/integration/browser suites and
dependency audit were not rerun for this source-preparation phase. No interface
messages changed. Commit-specific CI status is tracked separately on #289.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/scripts -p 'test_prepare_s6_source.py'
npx vitest run tests/unit/{s6-source,s7-archive,s8-archive,s10-archive,historical-archive,archive-key-visual}.test.ts
git diff --check
```
