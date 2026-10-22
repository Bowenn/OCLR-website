import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink, readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { HttpError } from "./http";
export const TEAM_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
function directory() {
  const root = process.env.OCLR_MEDIA_DIR;
  if (
    !root ||
    !root.startsWith("/") ||
    /\/releases(?:\/|$)/.test(resolve(root))
  )
    throw new HttpError(
      503,
      "Configure a durable team media directory outside application releases.",
    );
  return join(resolve(root), "teams");
}
export async function normalizeTeamImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > TEAM_IMAGE_MAX_BYTES)
    throw new HttpError(400, "Choose a JPEG, PNG or WebP image up to 5 MB.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16777216,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error();
    const output = await image
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    if (output.length > 1024 * 1024) throw new Error();
    return output;
  } catch {
    throw new HttpError(
      400,
      "Choose a valid static JPEG, PNG or WebP image with dimensions up to 4096 × 4096.",
    );
  }
}
export async function storeTeamImage(bytes: Buffer) {
  const normalized = await normalizeTeamImage(bytes);
  const root = directory();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const key = randomUUID(),
    temp = join(root, `.${key}.tmp`);
  try {
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(normalized);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, join(root, `${key}.webp`));
    const directoryHandle = await open(root, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    await unlink(temp).catch(() => {});
    await unlink(join(root, `${key}.webp`)).catch(() => {});
    throw error;
  }
  return key;
}
function file(key: string) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(key))
    throw new HttpError(404, "Team image not found.");
  return join(directory(), `${key}.webp`);
}
export async function removeTeamImage(key: string) {
  await unlink(file(key)).catch(() => {});
}
export async function readTeamImage(key: string) {
  const path = file(key),
    stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
    throw new HttpError(404, "Team image not found.");
  return readFile(path);
}
