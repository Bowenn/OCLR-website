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
