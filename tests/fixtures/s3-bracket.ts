import { historicalArchive } from "./historical-archive";
import type { HistoricalArchive } from "../../src/lib/historical-archive";
export function s3BracketFixture(): HistoricalArchive {
  const a = structuredClone(historicalArchive);
  a.sourceUrl =
    "https://docs.google.com/spreadsheets/d/1o4asx7nZQTAWwNjK_TyB_aq2ZWD471BHAxcdLp-TPAo";
  a.teams = Array.from("abcdefghij", (id) => ({
    id,
    name: `Synthetic ${id}`,
    source: "Synthetic",
  }));
  a.standings = [];
  const pairs = [
    ["ko-a1", "j", "h", 6, 5, "胜者组半决赛"],
    ["ko-a3", "a", "f", 6, 3, "胜者组半决赛"],
    ["ko-b2", "b", "g", 6, 5, "败者组第一轮"],
    ["ko-b4", "e", "i", 5, 6, "败者组第一轮"],
    ["ko-a5", "j", "a", 3, 6, "胜者组决赛"],
    ["ko-b6", "f", "i", 6, 5, "败者组第二轮"],
    ["ko-b7", "b", "h", 2, 6, "败者组第二轮"],
    ["ko-b8", "f", "h", 5, 6, "败者组第三轮"],
    ["ko-b9", "j", "h", 3, 7, "败者组决赛"],
    ["ko-a10", "a", "h", 2, 7, "总决赛"],
  ] as const;
  a.matches = pairs.map(([id, teamA, teamB, x, y, stage]) => ({
    ...a.matches[0],
    id,
    teamA,
    teamB,
    stage,
    label: id,
    score: [x, y],
    scheduledAt: null,
    mpUrls: [],
    source: "Synthetic",
  }));
  for (const [group, teams] of [
    ["A", "acgij"],
    ["B", "bdefh"],
  ]) {
    let n = 0;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++)
        a.matches.push({
          ...a.matches[0],
          id: `gs-${group.toLowerCase()}${++n}`,
          label: `Synthetic ${group}${n}`,
          stage: `小组赛 ${group}组`,
          teamA: teams[i],
          teamB: teams[j],
          score: [5, 5],
        });
  }
  return a;
}
