/** One selected public destination, including its detail routes. */
export function publicTournamentSection(path: string, base: string) {
  const suffix =
    path === base
      ? ""
      : path.startsWith(`${base}/`)
        ? path.slice(base.length + 1).split("/")[0]
        : null;
  if (suffix === null) return null;
  if (suffix === "matches") return "schedule";
  if (suffix === "register") return "";
  if (suffix === "team") return "teams";
  return suffix;
}
