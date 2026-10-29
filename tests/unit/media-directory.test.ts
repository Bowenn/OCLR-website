import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, realpath, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { mediaRoot, mediaDirectory } from "../../src/lib/media-directory";
const root = await realpath(await mkdtemp(join(tmpdir(), "oclr-media-test-")));
afterEach(() => vi.unstubAllEnvs());
it("shares path policy with the backup CLI and refuses public, release, app and symlink roots", async () => {
  try {
    expect(await mediaRoot(root)).toBe(root);
    const app = join(root, "app");
    await mkdir(app);
    const alias = join(root, "alias");
    await symlink(app, alias);
    for (const path of [
      "relative",
      join(root, "public"),
      join(root, "releases"),
      alias,
      app,
      join(app, "media"),
    ]) {
      if (path !== alias && path !== "relative")
        await mkdir(path, { recursive: true });
      await expect(mediaRoot(path, [app])).rejects.toMatchObject({
        status: 503,
      });
      expect(() =>
        execFileSync(
          process.execPath,
          ["--import", "tsx", "scripts/check-media-directory.ts", app],
          { env: { ...process.env, OCLR_MEDIA_DIR: path }, stdio: "pipe" },
        ),
      ).toThrow();
    }
    vi.stubEnv("OCLR_MEDIA_DIR", root);
    await symlink(app, join(root, "teams"));
    await expect(mediaDirectory("teams")).rejects.toMatchObject({
      status: 503,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
