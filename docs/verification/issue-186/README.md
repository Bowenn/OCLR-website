# Issue #186: Developer access

Developer is an explicitly granted **global read role**. A global Admin grants or
revokes it through Staff assignments, using the existing transactional role audit.
It can read private applications, unpublished editions, saved configuration,
source evidence and history. It does not map to Admin or gain any `manage_*`,
result, publication or configuration capability. The migration adds the enum value
and a database constraint rejecting edition-scoped Developer grants.

The organizer selected **additive permissions** on 2026-10-24: existing Admin,
Mappooler, Referee and Captain permissions remain active within their existing
scope and assignment limits. An account with Developer and another writing role
must not be described as wholly read-only. There is no role-switching mode.
For example, Developer + Mappooler for A can inspect B, but can edit pools only in
A; Developer + edition Admin can export registrations only in that Admin's scope.
Removing Developer removes its global private reads on the next authorization
check, without removing other grants. Bootstrap Admin behavior is unchanged.

## Read and download boundaries

Developer alone cannot bulk-export private registrations. Existing independent
`manage_registrations` grants retain their filtered export access. Protected team
avatars can be read in an authorized workspace. Application answers, prior
attempts, audit records, stored MP sources, result review history, archive previews,
and saved profile/BWS evidence are readable. No environment file, OAuth/provider
credential, database password, or session token is part of these view models.

Saved-only profile/BWS reads perform no provider refresh or cache claim. Developer
cannot trigger profile refreshes, beatmap/batch previews, manual enrollment
previews, MP imports/previews or historical statistics jobs. Existing independently
authorized write roles retain those operations under the original server checks.
Award previews calculate from existing edition data inside a read-only transaction;
they do not save recalculations or publish releases. Opening setup/new pages does
not initialize records or acquire business locks. Login/session management and
personal locale/theme/appearance preferences remain available. Developer alone
cannot submit/withdraw registrations; independently appointed Captains retain
Captain operations under the original server authorization.

## Entry-point inventory

`tests/integration/developer.test.ts` discovers **every exported mutation method**
in `src/app/api/admin/**/route.ts`, calls the real route handler with Developer-only
authorization, and checks 403, no provider calls and an unchanged snapshot of every
public database table. It covers:

| Surface                                                 | Read path                            | Write boundary                                          |
| ------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Site appearance                                         | settings GET/page                    | site settings PATCH                                     |
| Staff grants, revocation, About visibility              | staff GET/page                       | staff POST                                              |
| Editions, configuration, publication, archive import    | tournament GET/pages                 | tournaments and edition POST                            |
| Applications, answers, review, removal/restoration      | registrations GET/detail             | review, remove/restore POST                             |
| Manual enrollment and bulk enrollment                   | saved applications only              | preview/batch preview and create POST                   |
| Profiles and BWS                                        | saved-only profile/BWS read          | profile refresh and BWS review POST                     |
| Captain appointment, availability, order/publication    | captain GET/page                     | captain POST                                            |
| Teams, coaches, identity/roster publication             | teams GET/page, protected avatar GET | teams POST and multipart team PATCH before file storage |
| Draft setup/transitions/recovery/release                | draft GET/page and polling           | draft POST; picks retain staff/Captain server checks    |
| Rounds and pools, entries, sorting, refresh/publication | mappool GET/pages                    | mappool POST and provider preview POST                  |
| Fixtures, rules, groups, assignments                    | fixture GET/pages                    | matches POST and assignment PATCH                       |
| MP import, preview, reviewed results/publication        | saved source/history GET/page        | imports/preview and result POST                         |
| Historical statistics                                   | statistics GET/page                  | import/review/publish/withdraw POST                     |
| Awards                                                  | read-only calculation GET/page       | configuration/publish/withdraw POST                     |
| Audit history                                           | audit GET/page                       | no manual audit-write endpoint                          |

There are no Server Action or WebSocket mutation channels in this checkout. Draft
updates use authenticated GET polling. Future modules (including replay #185) must
use explicit read checks for saved reads and existing write capability checks
before uploads, replacements, deletion or other side effects.

The integration suite also checks no-role/scoped-role boundaries through existing
role tests, global/scoped/mixed-role behavior, immediate revocation with the same
user identity, grant audit actors, and unchanged business state after reads.
The browser regression uses real HTTP sessions to grant Developer, visit all
existing workspace modules/detail/new/preview paths, use filters and settings tabs,
block multipart uploads and exports, exercise additive Mappooler scope and polling
revocation, and inspect all three appearances, both themes and all three locales
on desktop/mobile.

New Chinese read-only and role-policy messages remain subject to organizer wording
review. Local synthetic verification does not assert live deployment or OAuth
rehearsal. CI status is reported separately in the PR.

## Local verification, 2026-10-24

- Fresh migration and upgrade from `origin/main` both passed in explicitly named,
  isolated PostgreSQL test databases. The upgrade preserved existing staff grants.
- Lint, `next typegen`/TypeScript, i18n extraction/catalog tests, production Turbopack
  build and production dependency audit passed (zero production vulnerabilities).
  Builds and browser servers used an isolated source copy without environment files.
- The full unit/integration run passed 108 files. The only failing file was an
  applicant-profile test mock missing the new read helpers; after correction its
  15 cases passed, including saved-only Developer profile rendering. Final affected
  suites passed 51 cases; the last fixture/result/Developer refinement passed all
  29 affected cases. One existing test remains intentionally skipped.
- All 26 current Admin POST/PATCH/PUT/DELETE handlers denied Developer-only writes
  without provider I/O, database changes or success audit records.
- Broad affected desktop/mobile browser run: 28 passed; the new Developer test had
  fixture/selector setup corrected. Final Developer + results + roles run: **6/6
  passed**, including all workspace routes, sensitive exports, multipart uploads,
  filters, additive Mappooler scope, assigned/unassigned Referee controls and live
  revocation. Design/theme/locale checks covered 18 combinations on each device,
  with the mobile viewport at 320px and no horizontal overflow.
- Three pre-existing browser scenarios failed on both devices in the broad run:
  `archive-statistics.spec.ts` expects the former unpublished-statistics message and
  technical-adjudication notice; `draft.spec.ts` expects public Captain badges.
  Each failure was reproduced with the same assertion on a clean production build
  of `origin/main` at `fc09bd9db06e292b4ffba624dea7b6f379a3d564`, in a separate baseline
  test database. These are recorded as existing CI gates; the full browser suite
  is **not** claimed green.

Representative English captures (all locales were exercised):

| Appearance    | Desktop/light                              | Mobile/dark                              |
| ------------- | ------------------------------------------ | ---------------------------------------- |
| Default       | [Capture](desktop-default-light.png)       | [Capture](mobile-default-dark.png)       |
| Cute pastel   | [Capture](desktop-cute-pastel-light.png)   | [Capture](mobile-cute-pastel-dark.png)   |
| Swiss minimal | [Capture](desktop-swiss-minimal-light.png) | [Capture](mobile-swiss-minimal-dark.png) |
