# Historical match-to-pool links (#242)

The schedule adapter previously hardcoded every pool to `—`. It now renders the pool name and an edition-scoped link. Imports may provide an optional `poolId`; schema validation rejects references to pools outside that archive. Explicit `null` means no confirmed relationship.

Existing saved archives do not need a destructive reimport. The source-specific supplement recognizes the exact organizer-provided workbook URL and the recorded stage: S8 and S9 group stages share GS, with SF/F/GF aliases matching their independent pools. S7 Group A/B share 小组赛, and 淘汰赛 maps to its namesake pool; LF/GF are not silently mapped to 决赛. S10 SF/Finals/GF match the source pool stages. An unrecognized workbook receives no inferred links.

Remaining evidence gap: S10 Schedule records Group A/B but not the GS1/GS2 pool split. The original S10 workbook and the two linked statistics exports were inspected; the statistics exports contain aggregate performances rather than MP identifiers. The organizer has been asked to confirm the match-number/date boundary. Until confirmed, these relationships remain unknown rather than guessed. S7 LF/GF also need evidence before assigning a pool. This PR must not claim all unknown mappings were resolved.

No production import or data mutation is performed by this change.
