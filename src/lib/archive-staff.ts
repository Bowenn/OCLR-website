import {
  recordedArchiveMatch,
  type HistoricalArchive,
} from "./historical-archive";

const s8Sheet =
  "/spreadsheets/d/16ASDCD95p3TgfjgSHCjXmRN3KJuuAD4KS0fImpcTiiM/edit";
/** Supplement only the organizer-identified S8 source; never grant live roles. */
export function archiveStaff(
  archive: HistoricalArchive,
): HistoricalArchive["staff"] {
  const source = new URL(archive.sourceUrl);
  if (source.hostname !== "docs.google.com" || source.pathname !== s8Sheet)
    return archive.staff;
  const staff = archive.staff.map((person) => ({ ...person }));
  for (const match of archive.matches.filter(recordedArchiveMatch)) {
    for (const [field, position] of [
      ["referee", "Referee"],
      ["streamer", "Streamer"],
      ["commentators", "Commentators"],
    ] as const) {
      // Only the explicit source separator splits people; spaces belong to usernames.
      for (const username of (match[field] ?? "")
        .split("、")
        .map((name) => name.trim())
        .filter(Boolean)) {
        if (
          staff.some(
            (person) =>
              person.username === username && person.position === position,
          )
        )
          continue;
        // Match records contain names, not IDs. Do not guess an account from a player name.
        const identities = new Set(
          archive.staff
            .filter(
              (person) => person.username === username && person.osuId !== null,
            )
            .map((person) => person.osuId),
        );
        staff.push({
          username,
          osuId: identities.size === 1 ? [...identities][0] : null,
          position,
          source: `${match.source}; ${field}`,
        });
      }
    }
  }
  return staff;
}
