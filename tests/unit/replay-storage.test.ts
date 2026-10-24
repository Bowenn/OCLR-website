import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import {
  realpath,
  mkdtemp,
  mkdir,
  writeFile,
  open,
  symlink,
  rm,
  readdir,
  stat,
  utimes,
} from "node:fs/promises";
import { join } from "node:path";
import {
  storeReplay,
  readReplay,
  cleanupReplayFiles,
  replayDirectory,
} from "../../src/lib/replay-storage";
import { REPLAY_STORAGE_MAX_BYTES } from "../../src/lib/replay-model";
let root: string;
beforeEach(async () => {
  root = await realpath(
    await mkdtemp(join(tmpdir(), "oclr-replay-storage-test-")),
  );
  vi.stubEnv("OCLR_MEDIA_DIR", root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
describe("durable private replay storage", () => {
  it("uses generated paths and private permissions, detects changed content and refuses symlink reads", async () => {
    const bytes = Buffer.from("synthetic byte equality fixture"),
      id = randomUUID(),
      sha = createHash("sha256").update(bytes).digest("hex");
    await storeReplay(id, bytes);
    const path = join(root, "replays", id + ".osr");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "replays"))).mode & 0o777).toBe(0o700);
    expect(await readReplay(id, bytes.length, sha)).toEqual(bytes);
    await writeFile(path, Buffer.alloc(bytes.length));
    await expect(readReplay(id, bytes.length, sha)).rejects.toMatchObject({
      status: 503,
    });
    await rm(path);
    await writeFile(join(root, "outside.osr"), bytes);
    await symlink(join(root, "outside.osr"), path);
    await expect(readReplay(id, bytes.length, sha)).rejects.toMatchObject({
      status: 503,
    });
  });
  it("counts physical orphans against total capacity before writing a file", async () => {
    await mkdir(join(root, "replays"));
    const file = await open(join(root, "replays", randomUUID() + ".osr"), "w");
    await file.truncate(REPLAY_STORAGE_MAX_BYTES);
    await file.close();
    await expect(
      storeReplay(randomUUID(), Buffer.from("x")),
    ).rejects.toMatchObject({ status: 507 });
    expect(await readdir(join(root, "replays"))).toHaveLength(1);
  });
  it("refuses public/release/symlink roots and keeps referenced/fresh/unknown files during cleanup", async () => {
    vi.stubEnv("OCLR_MEDIA_DIR", join(root, "releases", "media"));
    await expect(replayDirectory()).rejects.toMatchObject({ status: 503 });
    await symlink(root, root + "-link");
    try {
      vi.stubEnv("OCLR_MEDIA_DIR", root + "-link");
      await expect(replayDirectory()).rejects.toMatchObject({ status: 503 });
    } finally {
      await rm(root + "-link");
      vi.stubEnv("OCLR_MEDIA_DIR", root);
    }
    const active = randomUUID(),
      old = randomUUID(),
      fresh = randomUUID();
    for (const id of [active, old, fresh])
      await storeReplay(id, Buffer.from("test"));
    for (const id of [active, old])
      await utimes(
        join(root, "replays", id + ".osr"),
        new Date(0),
        new Date(0),
      );
    await writeFile(join(root, "replays", "unknown.txt"), "keep");
    expect(await cleanupReplayFiles(new Set([active]))).toBe(1);
    expect(await readdir(join(root, "replays"))).toHaveLength(3);
  });
});
