import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  historicalArchiveSchema,
  archiveCounts,
} from "../../src/lib/historical-archive";

const baseline = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s6-archive.json", "utf8")),
);
const confirmed = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s6-confirmed-archive.json", "utf8")),
);

it("reproduces the exact confirmed private import while retaining every source game", () => {
  const generated = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        "import importlib.util,json;s=importlib.util.spec_from_file_location('prepare','scripts/prepare-s6-confirmed-import.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.build(),ensure_ascii=False))",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      },
    ),
  );
  expect(generated).toEqual(confirmed);
  expect(archiveCounts(confirmed)).toEqual(archiveCounts(baseline));
  expect(
    Buffer.byteLength(
      readFileSync("docs/imports/s6-confirmed-archive.json", "utf8"),
    ),
  ).toBeLessThan(450000);
  for (const field of [
    "teams",
    "players",
    "unresolvedPlayers",
    "rosterReplacements",
    "pools",
    "staff",
    "picks",
    "standings",
  ] as const)
    expect(confirmed[field]).toEqual(baseline[field]);
  expect(
    confirmed.qualifiers!.map(({ name, poolId, records }) => ({
      name,
      poolId,
      records,
    })),
  ).toEqual(
    baseline.qualifiers!.map(({ name, poolId, records }) => ({
      name,
      poolId,
      records,
    })),
  );
  expect(confirmed.notes.join("\n")).not.toContain("尚未授權公開");
  expect(confirmed.notes.join("\n")).toContain("公開 S6 的指示");
  for (const m of confirmed.matches) {
    const before = baseline.matches.find((p) => p.id === m.id)!;
    expect(m.review!.games).toEqual(before.review!.games);
    expect(m.review!.rawScore).toEqual(before.review!.rawScore);
    expect(m.score).toBeNull();
    if (!["mp-84398168", "mp-85503945"].includes(m.id))
      expect(m).toEqual(before);
  }
  expect(
    confirmed.matches.reduce((n, m) => n + m.review!.games.length, 0),
  ).toBe(348);
});

it("records organizer-confirmed handling without manufacturing a missing HD2 score", () => {
  const di = confirmed.matches.find((m) => m.id === "mp-84398168")!.review!;
  const cf = confirmed.matches.find((m) => m.id === "mp-85503945")!.review!;
  expect(di.workingScore).toEqual([3, 5]);
  expect(di.rawScore).toEqual([3, 6]);
  expect(di.note).toContain("確認");
  expect(di.note).toContain("娛樂賽");
  expect(cf.workingScore).toEqual([2, 6]);
  expect(cf.rawScore).toEqual([2, 5]);
  expect(cf.possibleScore).toBeNull();
  expect(cf.note).toContain("HD2 為 F 隊獲勝");
  expect(cf.games.find((g) => g.gameId === 437459269)).toMatchObject({
    endTime: null,
    totals: { red: 0, blue: 0 },
  });
  expect(confirmed.sourceFacts![0].text).toContain(
    "這兩項已確認，取代先前推理",
  );
});
