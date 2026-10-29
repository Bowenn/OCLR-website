import { mediaRoot } from "../src/lib/media-directory";
// Used after dependency installation, before stopping writes or making a backup.
await mediaRoot(process.env.OCLR_MEDIA_DIR, [
  process.cwd(),
  ...process.argv.slice(2),
]);
