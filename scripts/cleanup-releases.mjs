// Called by cleanup-releases.sh while holding the installation's update lock.
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";

const [root, mode, count] = process.argv.slice(2);
const keep = Number(count);
function requireSafe(condition, message) {
  if (!condition) throw new Error(message);
}
function optionalStat(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

try {
  requireSafe(
    process.argv.length === 5 &&
      ["--dry-run", "--apply"].includes(mode) &&
      Number.isInteger(keep) &&
      keep >= 2 &&
      keep <= 9999,
    "Invoke cleanup-releases.sh with valid retention options.",
  );
  requireSafe(
    realpathSync(root) === root,
    "Installation path must be canonical.",
  );
  const releases = join(root, "releases");
  requireSafe(
    lstatSync(releases).isDirectory(),
    "The releases directory must be a real directory, not a symlink.",
  );
  const device = lstatSync(releases).dev;
  function protectedReleases() {
    const paths = [];
    for (const name of ["current", "previous"]) {
      const link = join(root, name);
      const info = optionalStat(link);
      if (!info && name === "previous") continue;
      requireSafe(info?.isSymbolicLink(), `${name} must be a release symlink.`);
      const target = realpathSync(link);
      requireSafe(
        dirname(target) === releases && lstatSync(target).isDirectory(),
        `${name} must point to an existing direct release directory.`,
      );
      paths.push(target);
    }
    return paths;
  }
  const protectedPaths = protectedReleases();
  const managed = [];
  for (const name of readdirSync(releases).sort()) {
    const path = join(releases, name);
    const info = lstatSync(path);
    const match = /^(\d{8}T\d{6}Z)-([a-f0-9]{12})-[A-Za-z0-9]{6}$/.exec(name);
    const marker = join(path, ".oclr-release");
    if (!match || !info.isDirectory() || !optionalStat(marker)?.isFile()) {
      console.log(`Preserve unrecognized entry: ${path}`);
      continue;
    }
    const sha = readFileSync(marker, "utf8").trim();
    if (!/^[a-f0-9]{40}$/.test(sha) || !sha.startsWith(match[2])) {
      console.log(`Preserve invalid release marker: ${path}`);
      continue;
    }
    managed.push(path);
  }
  // Use timestamped names, independent of build/cache modification times.
  const retained = new Set([...managed.slice(-keep), ...protectedPaths]);
  const candidates = managed.filter((path) => !retained.has(path));
  // Linux bind mounts may share st_dev with their parent. Check mount points too.
  const mounts =
    process.platform === "linux"
      ? readFileSync("/proc/self/mountinfo", "utf8")
          .trim()
          .split("\n")
          .map((line) =>
            line
              .split(" ")[4]
              .replace(/\\([0-7]{3})/g, (_, octal) =>
                String.fromCharCode(parseInt(octal, 8)),
              ),
          )
      : [];
  requireSafe(
    !candidates.some((path) =>
      mounts.some((mount) => mount === path || mount.startsWith(`${path}/`)),
    ),
    "A release contains a mount; unmount or preserve it before cleanup.",
  );
  // Validate the whole plan before deletion; never cross filesystem boundaries.
  function checkTree(path) {
    const info = lstatSync(path);
    requireSafe(
      info.dev === device,
      "A release contains another filesystem; inspect mounts before cleanup.",
    );
    if (info.isDirectory()) {
      for (const name of readdirSync(path)) checkTree(join(path, name));
    }
  }
  for (const path of candidates) checkTree(path);
  console.log(
    `Release cleanup ${mode}: keep newest ${keep}, plus current/previous. Backups and media are untouched.`,
  );
  for (const path of [...retained].sort()) console.log(`Keep: ${path}`);
  for (const path of candidates) {
    requireSafe(
      protectedReleases().join("\n") === protectedPaths.join("\n"),
      "Release links changed; abort cleanup and inspect concurrent activity.",
    );
    console.log(`${mode === "--apply" ? "Remove" : "Would remove"}: ${path}`);
    if (mode === "--apply") rmSync(path, { recursive: true });
  }
  console.log(
    `${mode === "--apply" ? "Removed" : "Would remove"} ${candidates.length} old release(s).`,
  );
} catch (error) {
  console.error(`Release cleanup refused: ${error.message}`);
  process.exitCode = 1;
}
