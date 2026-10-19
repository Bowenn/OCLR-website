import { readFileSync } from "node:fs";
import defaultBrackets from "@/content/brackets.json" with { type: "json" };
import {
  bracketTeamIds,
  bracketsSchema,
  resolveBracket,
} from "./bracket-model";
import { getPublicEdition } from "./content";
import { publishedTeams } from "./teams";
export function getBrackets() {
  const file = process.env.OCLR_BRACKETS_FILE;
  return bracketsSchema.parse(
    file
      ? JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8"))
      : defaultBrackets,
  );
}
export async function publicBracket(slug: string) {
  if (!getPublicEdition(slug)) return null;
  const bracket = getBrackets().find(
    (b) => b.editionSlug === slug && b.published,
  );
  if (!bracket) return null;
  const teams = (await publishedTeams(slug)).filter(
    (t) => t.finalized && t.members !== null,
  );
  if (bracketTeamIds(bracket).some((id) => !teams.some((t) => t.id === id)))
    return null;
  return resolveBracket(bracket, teams);
}
