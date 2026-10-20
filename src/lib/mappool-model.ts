export const categories = ["NM", "HD", "DT", "HR", "FM", "TB"] as const;
export const categoryNames = {
  NM: "No Mod",
  HD: "Hidden",
  DT: "Double Time",
  HR: "Hard Rock",
  FM: "FM",
  TB: "Tie Breaker",
};
export function slotLabel(category: string, position: number) {
  return category === "TB" && position === 1 ? "TB" : `${category}${position}`;
}
