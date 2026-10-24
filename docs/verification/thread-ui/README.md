# Registration and player UI batch: #225, #227, #229, #232

Verified locally on 2026-10-24 (Asia/Taipei). All accounts, answers, messages and tournaments shown here are synthetic. No production database, OAuth credentials, demo process or deployment was used.

## Changes and commits

- #225 — `acdd1d8`: preserve authored eligibility newlines; separate the existing disclosure into readable paragraphs without changing its wording; keep the privacy link and sentence punctuation together.
- #227 — `f025bf0`: describe deferred totals with the same scoped, translated count sentence and styling as pending reviews. The organizer approved the Traditional/Simplified Chinese sentence in this chat on 2026-10-24.
- #229 — `d84ac03`: neutralize the inherited theme hover translation and use an inset focus outline within the reaction scroller.
- #232 — `ee0ea58`: content-sized player rows; one initially random recent message with previous/next navigation; collapsed composition, cancel preserving draft, success collapse and selection of the new message; owner-only edit/delete, confirmation, error recovery and server-side optimistic concurrency. Transactional metadata audit preserves posting limits and prevents a deleted post from being resurrected by a repeated request.
- #231 remains cancelled. No registration-question/default/required-field rules or self-introduction mapping were changed.

## Verification

- `npm run check`: lint and route/type generation + TypeScript passed.
- `npm run i18n:extract` and `npm run test:i18n`: passed (4 tests); all new interface strings have en/zh-Hans/zh-Hant translations. Existing privacy/eligibility meanings are unchanged.
- Full unit/integration suite: **115 files, 840 passed, 1 skipped**; used only isolated PostgreSQL 17 database `oclr_thread_ui_test` on a dedicated temporary instance. Final affected message service rerun: **6 passed**.
- Production build passed. No database migration is required.
- Production dependency audit: **0 vulnerabilities**.
- Google Chrome Playwright: **4 desktop/mobile tests passed** across the two specs. Registration/admin tests cover en/zh-Hans/zh-Hant × three appearances × light/dark at 1440px/320px. Player tests cover the same combinations, with real create/edit/delete requests, stale-write rejection, unauthenticated rejection, an injected network failure, draft cancellation, single-message navigation and emoji picker/hover/focus interactions.
- Authorization/concurrency integration checks cover non-authors, wrong edition/target, unpublished targets, forged/empty inputs, competing edits, stale delete, repeated delete/post requests, audit events and posting limits after deletion.
- CI is authoritative and is reported separately on the issues; this document records local evidence, not CI or production acceptance.

## Real baseline comparison

The unchanged `c47cb75` baseline and the fixed production build ran separately on loopback ports against the same synthetic data and session. PNG names use CSS viewport widths; the `before` images are actual baseline renders, not reconstructed mockups.

| Measurement                                     |                    Before |                            After |
| ----------------------------------------------- | ------------------------: | -------------------------------: |
| Player row at 1440px, ordinary signed-in viewer |                  332.30px |                         159.86px |
| Same row at 320px                               |                  634.13px |                         451.41px |
| Desktop emoji hover translation after settling  | -1px (above scroller top) | none (aligned with scroller top) |

The owner screenshots separately show edit/delete controls. Player screenshot dates identify synthetic messages; source answers and messages remain literal.

- Players: [desktop before](players-1440-before.png) / [after](players-1440-after.png), [mobile before](players-320-before.png) / [after](players-320-after.png).
- Emoji hover: [before](reaction-hover-before.png) / [after](reaction-hover-after.png).
- Registration: [desktop before](registration-1440-before.png) / [after](registration-1440-after.png), [mobile before](registration-320-before.png) / [after](registration-320-after.png).
- Deferred overview: [desktop before](admin-1440-before.png) / [after](admin-1440-after.png), [mobile before](admin-320-before.png) / [after](admin-320-after.png).
- Owner controls: [desktop light](owner-desktop-light.png), [desktop dark](owner-desktop-dark.png), [mobile light](owner-mobile-light.png), [mobile dark](owner-mobile-dark.png).
