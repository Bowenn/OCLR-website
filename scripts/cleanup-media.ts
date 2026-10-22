/** Run with site writes stopped; only abandoned files older than one day. */
import { readdir, lstat, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { db, closeDb } from "../src/db";
import { teams } from "../src/db/schema";
const root = process.env.OCLR_MEDIA_DIR;
try {
  if (!root?.startsWith("/") || /\/releases(?:\/|$)/.test(resolve(root)))
    throw new Error("Configure the durable OCLR_MEDIA_DIR first.");
  const active = new Set(
    (await db().select({ key: teams.avatarKey }).from(teams)).map((t) => t.key),
  );
  const directory = join(root, "teams");
  let removed = 0;
  for (const name of await readdir(directory)) {
    const match = /^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.webp$/.exec(
      name,
    );
    if (!match || active.has(match[1])) continue;
    const path = join(directory, name),
      stat = await lstat(path);
    if (
      stat.isFile() &&
      !stat.isSymbolicLink() &&
      Date.now() - stat.mtimeMs > 86400000
    ) {
      await unlink(path);
      removed++;
    }
  }
  console.log(`Removed ${removed} unreferenced old team images.`);
} finally {
  await closeDb();
}
