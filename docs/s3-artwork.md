# S3 artwork and private preview (#286)

The organizer supplied `S3.avif` for OCLR Season 3. The original bytes are
preserved as `public/archive/s3/key-visual.avif`, at 995×621, with SHA-256
`9485eb5d819e80e94f827491e6fca96462a59c738f7dcb2ab5b9717395ac7e43`.

The existing logo/key-visual selectors and saved configuration allowlist accept
this path. Historical artwork fallback matches the exact S3 MainSheet source ID
`1o4asx7nZQTAWwNjK_TyB_aq2ZWD471BHAxcdLp-TPAo`, independently of an editable
edition slug. An explicit configured image retains priority. Both the historical
overview and directory artwork use the original dimensions. No registration,
approval or publication state is changed by this asset supplement.

## Live private-preview verification — 2026-10-26

Before the artwork deployment, computer use verified the existing S3 private
preview's four saved original sections: `赛程规则`, `比赛规则`, `赛程安排`,
and `STAFF`. Each full body matched the organizer PDF transcript after ignoring
layout whitespace. The BO11 wording remains literal; the evidence of BO13 final
matches remains separately recorded in the administrator appendix.

The saved archive contains 30 approved results and the reconstructed placements
H/A/J/F as first through fourth, B/I tied fifth, E/G tied seventh and C/D tied
ninth. Existing scores follow MainSheet; the three missing scores follow MP.
These placements and full-event statistics were read back from the Admin UI and
matched the prepared snapshot. S3 remains unpublished.

## Deployment handoff

The current live artwork selector does not yet include S3. After review/merge and
organizer deployment, use the S3 Admin general settings to select **OCLR Season 3**
for its logo and key visual, save, then verify the private overview image and
directory thumbnail. Recheck the four rule sections and placements in the saved
private preview. Do not publish S3 without a separate organizer request.

This patch requires no database migration. Local checks do not establish live
deployment or artwork display acceptance; record those separately in #286.

## Public rule display follow-up — 2026-10-26

The organizer deployed the artwork change. Computer use saved the S3 logo and
key visual, reloaded them, and verified the image, all four original rule bodies
and ten placements in the private preview. The organizer then explicitly
authorized publication. S3 was published; its public artwork and ten placements
were verified, and administrator source appendices remained absent.

That public check exposed a reader gap: the private preview could render the
archival rule facts, while public projection correctly removed them. S3 had no
exact source binding to its saved native rules, so its public rules said
"Not recorded". A private-preview text comparison alone did not establish public
rule display acceptance.

The follow-up binds the exact S3 workbook (with or without `/edit`) to the
edition's current saved native version, like S4. It neither publishes source
facts nor serves a frozen rule snapshot. `imports/s3-rules.json` is the original
transcript used for verification; `public/archive/s3/rules.pdf` preserves the
organizer's original PDF bytes, SHA-256
`78ba8f1c5a95e7898e3ec41ba4ccbc219ca0f88ca68f3874bb72339f9c365fd5`.
The four chapters and original BO11 wording remain unchanged.

Regression coverage checks the saved rule reader after public projection,
current-version precedence, exact source matching and anonymous desktop/mobile
rule rendering with the source appendix hidden. The live public rules still
need deployment and a separate computer-use check after this follow-up is
reviewed and merged. No database migration or publication-state change is part
of the fix.
