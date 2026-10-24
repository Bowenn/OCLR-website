# Internal streaming tasks (#187)

Organizer-confirmed on 2026-10-24: self-selection immediately confirms one exclusive Streamer per fixture; a Streamer may cancel either self-selected or staff-assigned tasks. Matching start times warn without blocking. Authorized Streamers may see unpublished fixture schedules, round names, pairings and status. Registration answers/contact details, review notes, unreleased mappools and unrelated staff modules remain outside this role.

Admins grant/revoke `streamer` through existing scoped staff management. Only a current `streamer` grant for the edition (or a global Streamer grant) qualifies a candidate. Admin has `manage_streaming` to assign, replace, cancel or reconfirm bookings, but requires a Streamer grant to self-select. Existing Referee and Mappooler grants gain no streaming authority. Global Developer reads from #186 include this workspace without booking or assigning; existing Developer fixture/result reads are preserved.

Open **Streaming tasks** in the edition's competition navigation. Filter by match-local date, round, unassigned upcoming matches or **My streaming tasks**. Match cards return to the existing match detail URL. The detail shows immutable streaming changes with actor IDs and timestamps. Tasks are the first reminder surface; no external messages are sent.

One row in `fixture_streams` holds the current booking, separate from referee assignments. `fixtures.stream_revision` and fixture version prevent stale changes. Clients retain a UUID per reviewed command for network retries; the corresponding immutable `edition_events` entry makes repeated requests idempotent. The transaction shares the role-management advisory lock, then edition and fixture locks, validates the actor/target again, writes the assignment and its audit event atomically. Reassignment always requires staff authority and a current revision. An occupied fixture cannot be replaced by self-selection.

Rescheduling preserves attribution and requires explicit reconfirmation of the new start/time zone. Cancelled and approved/completed fixtures retain task history and cannot accept new bookings; existing bookings can be cancelled. A booked fixture must have its task cancelled before deletion. Streaming history survives fixture deletion in the edition audit stream. No changes are made to public fixture projections or OBS/presenter styles.

Same-start warnings compare active unfinished bookings in this edition only. No end time or fixed match duration is invented; these warnings are not a complete overlap check and do not establish availability across editions. Every displayed start includes its stored time zone. No stream links or Streamer identities are published through booking.

New Chinese interface wording is supplied in both catalogs and remains subject to organizer review. Local automated verification does not attest a live deployment or real-person scheduling rehearsal.
