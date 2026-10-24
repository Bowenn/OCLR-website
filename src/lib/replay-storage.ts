import { randomUUID, createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  mkdir,
  open,
  rename,
  unlink,
  lstat,
  readdir,
  realpath,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { HttpError } from "./http";
import {
  REPLAY_MAX_BYTES,
  REPLAY_STORAGE_MAX_BYTES,
  REPLAY_STORAGE_MAX_FILES,
} from "./replay-model";
const keyPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export async function replayDirectory() {
  const root = process.env.OCLR_MEDIA_DIR;
  if (
    !root?.startsWith("/") ||
    /\/(?:releases|public)(?:\/|$)/.test(resolve(root))
  )
    throw new HttpError(
      503,
      "Configure durable private replay storage outside application releases.",
    );
  const resolved = await realpath(root).catch(() => "");
  if (
    !resolved ||
    resolved !== resolve(root) ||
    resolved === process.cwd() ||
    resolved.startsWith(process.cwd() + sep)
  )
    throw new HttpError(
      503,
      "Configure durable private replay storage outside application releases.",
    );
  const directory = join(resolved, "replays");
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new HttpError(503, "Replay storage is unavailable.");
  return directory;
}
function replayPath(directory: string, key: string) {
  if (!keyPattern.test(key)) throw new HttpError(404, "Replay not found.");
  return join(directory, `${key}.osr`);
}
// Call under the shared database storage lock; includes abandoned files in quota accounting.
export async function storeReplay(key: string, bytes: Buffer) {
  const directory = await replayDirectory();
  let total = bytes.length,
    count = 1;
  for (const name of await readdir(directory)) {
    const stat = await lstat(join(directory, name));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new HttpError(503, "Replay storage is unavailable.");
    total += stat.size;
    count++;
    if (total > REPLAY_STORAGE_MAX_BYTES || count > REPLAY_STORAGE_MAX_FILES)
      throw new HttpError(
        507,
        "Replay storage capacity reached. Ask an Admin to archive or clean up files.",
      );
  }
  const target = replayPath(directory, key),
    temp = join(directory, `.${key}.${randomUUID()}.tmp`);
  const handle = await open(temp, "wx", 0o600);
  try {
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(temp, target);
    const parent = await open(directory, "r");
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}
export async function readReplay(key: string, size: number, sha256: string) {
  try {
    const directory = await replayDirectory();
    const handle = await open(
      replayPath(directory, key),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== size || stat.size > REPLAY_MAX_BYTES)
        throw new Error();
      const bytes = await handle.readFile();
      if (createHash("sha256").update(bytes).digest("hex") !== sha256)
        throw new Error();
      return bytes;
    } finally {
      await handle.close();
    }
  } catch {
    throw new HttpError(
      503,
      "Replay file is missing or damaged. Ask an Admin to restore the matching backup.",
    );
  }
}
export async function removeReplayFile(key: string) {
  await unlink(replayPath(await replayDirectory(), key)).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    },
  );
}
/** Offline maintenance only. Files younger than a day may belong to an in-flight write. */
export async function cleanupReplayFiles(
  active: Set<string>,
  now = Date.now(),
) {
  const directory = await replayDirectory();
  let removed = 0;
  for (const name of await readdir(directory)) {
    const match = /^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\.osr$/.exec(
      name,
    );
    const temporary = /^\.[a-f0-9-]{36}\.[a-f0-9-]{36}\.tmp$/.test(name);
    if ((!match && !temporary) || (match && active.has(match[1]))) continue;
    const path = join(directory, name),
      stat = await lstat(path);
    if (
      stat.isFile() &&
      !stat.isSymbolicLink() &&
      now - stat.mtimeMs > 86400000
    ) {
      await unlink(path);
      removed++;
    }
  }
  return removed;
}
