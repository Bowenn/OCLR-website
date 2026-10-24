# Historical match-to-pool links (#242)

The schedule adapter previously hardcoded every pool to `—`. It now renders the pool name and an edition-scoped link. Imports may provide an optional `poolId`; schema validation rejects references to pools outside that archive. Explicit `null` means no confirmed relationship.

Existing saved archives do not need a destructive reimport. The source-specific supplement recognizes the exact organizer-provided workbook URL and the recorded stage: S8 and S9 group stages share GS, with SF/F/GF aliases matching their independent pools. S7 Group A/B share 小组赛, and 淘汰赛 maps to its namesake pool; LF/GF are not silently mapped to 决赛. S10 SF/Finals/GF match the source pool stages. An unrecognized workbook receives no inferred links.

S10's two group-stage pools were verified on 2026-10-25 by retrieving all public MP event pages (Accept: application/json, before/limit pagination) for the 20 recorded group matches. Only completed games with score records were considered. Shared beatmap 5015365 cannot distinguish pools and is excluded from the exclusive-map comparison. Each match has at least five distinct played maps exclusive to one pool and zero exclusive maps from the other. Unmatched maps, including potential warmups, are not evidence for either pool. Match 1–5 and 11–15 use GS1; 6–10 and 16–20 use GS2. `src/content/s10-match-pools.json` retains only match URL, game/beatmap IDs and aggregate verification counts, with no user objects or individual scores. Runtime lookup requires the exact workbook, match ID and MP URL; no live requests run during rendering.

S7 LF/GF remain unknown pending matching evidence rather than automatically assigning the Finals pool.

No production import or data mutation is performed by this change.
