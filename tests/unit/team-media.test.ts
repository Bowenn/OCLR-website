import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  normalizeTeamImage,
  storeTeamImage,
  readTeamImage,
  removeTeamImage,
} from "../../src/lib/team-media";
describe("bounded persistent team image storage", () => {
  it("decodes and strips untrusted metadata into a static square WebP", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const bytes = await sharp({
        create: { width: 900, height: 600, channels: 3, background: "#aa44bb" },
      })
        .toFormat(format)
        .toBuffer();
      const result = await normalizeTeamImage(bytes);
      const metadata = await sharp(result).metadata();
      expect(metadata).toMatchObject({
        format: "webp",
        width: 512,
        height: 512,
      });
      expect(metadata.exif).toBeUndefined();
    }
  });
  it("rejects HTML/SVG, huge bytes, excess pixels and corrupt images", async () => {
    for (const bytes of [
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
      ),
      Buffer.from("<html>not an image</html>"),
      Buffer.alloc(5 * 1024 * 1024 + 1),
      Buffer.from([1, 2, 3]),
    ])
      await expect(normalizeTeamImage(bytes)).rejects.toMatchObject({
        status: 400,
      });
    const bomb = await sharp({
      create: { width: 4100, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(normalizeTeamImage(bomb)).rejects.toMatchObject({
      status: 400,
    });
  });
  it("retains the same opaque reference across release changes and safely removes replaced files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "oclr-team-media-test-"));
    vi.stubEnv("OCLR_MEDIA_DIR", directory);
    try {
      const bytes = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "purple" },
      })
        .png()
        .toBuffer();
      const key = await storeTeamImage(bytes);
      expect(key).toMatch(/^[a-f0-9-]{36}$/);
      expect((await readTeamImage(key)).length).toBeGreaterThan(0);
      await expect(readTeamImage("../../secret")).rejects.toMatchObject({
        status: 404,
      });
      await removeTeamImage(key);
      await expect(readTeamImage(key)).rejects.toThrow();
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
