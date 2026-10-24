import { describe, expect, it } from "vitest";
import { parseReplay } from "../../src/lib/replay-parser";
import { syntheticReplay, replayChecksum } from "../fixtures/replay";
import { REPLAY_MAX_BYTES } from "../../src/lib/replay-model";
describe("bounded stable replay validation", () => {
  it("extracts literal identities, checksum, ruleset and mods for supported stable containers", async () => {
    for (const mode of [0, 1, 2, 3])
      expect(
        await parseReplay(
          syntheticReplay({ mode, player: "[Literal] 123", mods: 8 }),
        ),
      ).toMatchObject({
        format: "stable",
        beatmapMd5: replayChecksum,
        playerName: "[Literal] 123",
        mods: 8,
        mode: ["osu", "taiko", "fruits", "mania"][mode],
      });
    expect(
      (await parseReplay(syntheticReplay({ version: 20140721, mods: 1 << 23 })))
        .version,
    ).toBe(20140721);
  });
  it("rejects unsupported lazer/old versions and disguised, truncated or trailing content", async () => {
    for (const version of [20140720, 30000000, 30000001])
      await expect(
        parseReplay(syntheticReplay({ version })),
      ).rejects.toMatchObject({ status: 415 });
    const valid = syntheticReplay();
    for (const b of [
      valid.subarray(0, 20),
      valid.subarray(0, -1),
      Buffer.concat([valid, Buffer.from("hidden")]),
      syntheticReplay({ mode: 4 }),
      syntheticReplay({ md5: "x".repeat(32) }),
      syntheticReplay({ player: "Fake\nName" }),
      syntheticReplay({ frames: "<script>alert(1)</script>" }),
      syntheticReplay({ frames: "" }),
    ])
      await expect(parseReplay(b)).rejects.toMatchObject({ status: 400 });
    await expect(
      parseReplay(Buffer.from("<html>fake.osr</html>")),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      parseReplay(Buffer.alloc(REPLAY_MAX_BYTES + 1)),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects damaged LZMA, excessive expansion and dictionary allocation", async () => {
    const b = syntheticReplay();
    b[b.length - 12] ^= 255;
    await expect(parseReplay(b)).rejects.toMatchObject({ status: 400 });
    const bomb = syntheticReplay({ frames: "0|0|0|0,".repeat(2200000) });
    await expect(parseReplay(bomb)).rejects.toMatchObject({ status: 400 });
    const dictionary = syntheticReplay();
    // Locate the LZMA header after the little-endian compressed size.
    const lzmaOffset = dictionary.indexOf(Buffer.from([0x5d, 0, 0, 0x80, 0]));
    expect(lzmaOffset).toBeGreaterThan(0);
    dictionary.writeUInt32LE(0x40000000, lzmaOffset + 1);
    await expect(parseReplay(dictionary)).rejects.toMatchObject({
      status: 400,
    });
  });
});
