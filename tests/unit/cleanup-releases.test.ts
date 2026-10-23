import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("../../scripts/cleanup-releases.sh", import.meta.url),
);
const roots: string[] = [];
const nativeFlock = spawnSync("/bin/sh", ["-c", "command -v flock"], {
  encoding: "utf8",
}).stdout.trim();

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture(failure = "") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "oclr-cleanup-test-")));
  roots.push(root);
  const install = join(root, "install"),
    releases = join(install, "releases"),
    bin = join(root, "bin"),
    backup = join(root, "backups"),
    media = join(root, "media");
  for (const path of [releases, bin, backup, media])
    mkdirSync(path, { recursive: true });
  for (const path of [backup, media])
    writeFileSync(join(path, "retain"), "fixture-data");
  writeFileSync(join(install, ".update.lock"), "");
  const versions = Array.from({ length: 8 }, (_, i) => {
    const sha = String(i + 1).repeat(40);
    const path = join(
      releases,
      `2026100${i + 1}T120000Z-${sha.slice(0, 12)}-ABC123`,
    );
    mkdirSync(path);
    writeFileSync(join(path, ".oclr-release"), `${sha}\n`);
    writeFileSync(join(path, "payload"), "old instance");
    return path;
  });
  symlinkSync(versions[0], join(install, "current"));
  symlinkSync(versions[1], join(install, "previous"));
  symlinkSync(process.execPath, join(bin, "node"));
  writeFileSync(
    join(bin, "flock"),
    '#!/bin/bash\n[[ "$CLEANUP_FAILURE" != lock ]]\n',
    { mode: 0o700 },
  );
  writeFileSync(
    join(bin, "systemctl"),
    `#!/bin/bash
case "$1" in
  show)
    if [[ "$2" == --property=User ]]; then
      if [[ "$CLEANUP_FAILURE" == user ]]; then printf 'wrong-user\\n'; else id -un; fi
    else
      if [[ "$CLEANUP_FAILURE" == directory ]]; then printf '/wrong/path\\n'; else printf '%s/current\\n' "$OCLR_INSTALL_DIR"; fi
    fi ;;
  is-active) [[ "$CLEANUP_FAILURE" != stopped ]] ;;
  *) exit 99 ;;
esac
`,
    { mode: 0o700 },
  );
  const run = (args: string[] = [], extra: Record<string, string> = {}) =>
    spawnSync("/bin/bash", [script, ...args], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        OCLR_INSTALL_DIR: install,
        OCLR_SERVICE: "oclr.service",
        CLEANUP_FAILURE: failure,
        ...extra,
      },
    });
  return { root, install, releases, bin, backup, media, versions, run };
}

describe("explicit release instance cleanup", () => {
  it("previews by default, protecting current/previous even when they are old", () => {
    const f = fixture();
    const before = readdirSync(f.releases);
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Would remove 3 old release(s).");
    expect(result.stdout).toContain(`Keep: ${f.versions[0]}`);
    expect(result.stdout).toContain(`Keep: ${f.versions[1]}`);
    expect(readdirSync(f.releases)).toEqual(before);
    expect(readFileSync(join(f.install, ".update.lock"), "utf8")).toBe("");
  });

  it("deletes only eligible directories, leaving external symlink targets, backups and media intact", () => {
    const f = fixture();
    symlinkSync(f.media, join(f.versions[2], "linked-media"));
    const result = f.run(["--apply"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Removed 3 old release(s).");
    expect(f.versions.map(existsSync)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    for (const path of [f.media, f.backup])
      expect(readFileSync(join(path, "retain"), "utf8")).toBe("fixture-data");
    expect(f.run(["--apply"]).stdout).toContain("Removed 0 old release(s).");
  });

  it("honors keep counts and optional previous on a first installation", () => {
    const f = fixture();
    rmSync(join(f.install, "previous"));
    const result = f.run(["--keep", "5", "--apply"]);
    expect(result.status, result.stderr).toBe(0);
    expect(f.versions.map(existsSync)).toEqual([
      true,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("refuses the entire plan when a later candidate contains a bind mount", () => {
    const f = fixture();
    const mounted = join(f.versions[4], "shared files");
    mkdirSync(mounted);
    const preload = join(f.root, "mount-fixture.mjs");
    // A bind mount can share st_dev, so simulate only the kernel mount table.
    writeFileSync(
      preload,
      `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
Object.defineProperty(process, 'platform', { value: 'linux' });
const original = fs.readFileSync;
fs.readFileSync = function(path, ...args) {
  if (path === '/proc/self/mountinfo') return ${JSON.stringify(`1 0 0:1 / ${mounted.replaceAll(" ", "\\040")} rw - ext4 /dev/test rw\n`)};
  return original.call(this, path, ...args);
};
syncBuiltinESMExports();
`,
    );
    const result = f.run(["--apply"], {
      NODE_OPTIONS: `--import=${preload}`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("A release contains a mount");
    expect(f.versions.every(existsSync)).toBe(true);
  });

  it("preserves unknown, incomplete and malformed directories, files and symlinks", () => {
    const f = fixture();
    const unknown = join(f.releases, "manual-install"),
      incomplete = join(f.releases, "20260901T000000Z-aaaaaaaaaaaa-ABC123"),
      invalid = join(f.releases, "20260902T000000Z-bbbbbbbbbbbb-ABC123"),
      linkedMarker = join(f.releases, "20260903T000000Z-cccccccccccc-ABC123"),
      linkedRelease = join(f.releases, "20260904T000000Z-dddddddddddd-ABC123");
    for (const path of [unknown, incomplete, invalid, linkedMarker])
      mkdirSync(path);
    writeFileSync(join(invalid, ".oclr-release"), "a".repeat(40));
    writeFileSync(join(f.root, "marker"), "c".repeat(40));
    symlinkSync(join(f.root, "marker"), join(linkedMarker, ".oclr-release"));
    symlinkSync(f.media, linkedRelease);
    writeFileSync(join(f.releases, "notes"), "preserve");
    const result = f.run(["--apply"]);
    expect(result.status, result.stderr).toBe(0);
    for (const path of [
      unknown,
      incomplete,
      invalid,
      linkedMarker,
      linkedRelease,
    ])
      expect(existsSync(path)).toBe(true);
    expect(lstatSync(linkedRelease).isSymbolicLink()).toBe(true);
    expect(result.stdout).toContain("Preserve invalid release marker");
    expect(readFileSync(join(f.releases, "notes"), "utf8")).toBe("preserve");
  });

  it.each(["lock", "stopped", "user", "directory"])(
    "refuses %s without deletion or service mutation",
    (failure) => {
      const f = fixture(failure);
      expect(f.run(["--apply"]).status).toBe(1);
      expect(f.versions.every(existsSync)).toBe(true);
    },
  );

  it.each(["current", "previous", "releases", ".update.lock"])(
    "rejects unsafe %s links before deleting anything",
    (name) => {
      const f = fixture();
      if (name === "releases") {
        const moved = join(f.root, "outside-releases");
        mkdirSync(moved);
        // Preserve the actual instances while testing a linked release parent.
        renameSync(f.releases, join(f.root, "preserved-releases"));
        symlinkSync(moved, f.releases);
      } else {
        rmSync(join(f.install, name));
        symlinkSync(f.media, join(f.install, name));
      }
      expect(f.run(["--apply"]).status).toBe(1);
      expect(readFileSync(join(f.media, "retain"), "utf8")).toBe(
        "fixture-data",
      );
    },
  );

  it("rejects dangling previous links and missing lock files", () => {
    const f = fixture();
    rmSync(join(f.install, "previous"));
    symlinkSync(join(f.releases, "missing"), join(f.install, "previous"));
    expect(f.run(["--apply"]).status).toBe(1);
    rmSync(join(f.install, ".update.lock"));
    expect(f.run().status).toBe(1);
    expect(existsSync(join(f.install, ".update.lock"))).toBe(false);
    expect(f.versions.every(existsSync)).toBe(true);
  });

  it.each([
    ["--keep", "0"],
    ["--keep", "1"],
    ["--keep", "-1"],
    ["--keep", "2x"],
    ["--keep"],
    ["--keep", "99999"],
    ["--apply", "--dry-run"],
    ["--keep", "3", "--keep", "4"],
    ["--unknown"],
  ])("rejects malformed options %j", (...args) => {
    const f = fixture();
    expect(f.run(args).status).toBe(1);
    expect(f.versions.every(existsSync)).toBe(true);
  });

  it.skipIf(!nativeFlock)(
    "shares a real advisory lock with an in-flight updater on Linux",
    async () => {
      const f = fixture();
      rmSync(join(f.bin, "flock"));
      symlinkSync(nativeFlock, join(f.bin, "flock"));
      const child = spawn(
        "/bin/bash",
        [
          "-c",
          'exec 9>"$1"; "$2" -n 9 || exit; printf "locked\\n"; read -r _',
          "test",
          join(f.install, ".update.lock"),
          nativeFlock,
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      try {
        await new Promise<void>((resolve, reject) => {
          child.stdout.once("data", () => resolve());
          child.once("error", reject);
          child.once("exit", () =>
            reject(new Error("Lock holder exited early")),
          );
        });
        const result = f.run(["--apply"]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Another update or cleanup");
        expect(f.versions.every(existsSync)).toBe(true);
      } finally {
        child.stdin.end("done\n");
        await new Promise((resolve) => child.once("exit", resolve));
      }
      expect(f.run(["--apply"]).status).toBe(0);
    },
  );
});
