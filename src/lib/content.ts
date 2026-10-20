import { db } from "@/db";
import { readTournament, readTournaments } from "./tournaments";
// PostgreSQL is authoritative. No JSON fallback, process cache or automatic seed.
// Fresh reads also allow publication rechecks after slow provider I/O.
export async function getEditions() {
  return (await readTournaments()).map((row) => row.edition);
}
export async function getPublicEditions() {
  return (await readTournaments(true)).map((row) => row.edition);
}
export async function getPublicEdition(slug: string) {
  if (!process.env.DATABASE_URL) return undefined;
  return (await readTournament(slug, db(), true))?.edition;
}
