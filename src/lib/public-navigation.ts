/** One selected public destination, including its detail routes. */
export function publicTournamentSection(path: string, base: string) {
  const suffix =
    path === base
      ? ""
      : path.startsWith(`${base}/`)
        ? path.slice(base.length + 1).split("/")[0]
        : null;
  if (suffix === null) return null;
  if (suffix === "participants") return "players";
  if (suffix === "matches") return "schedule";
  if (suffix === "register") return "";
  if (suffix === "team") return "teams";
  return suffix;
}

/** A single public appearance boundary; operational tools keep their dark UI. */
export function isPublicPage(path: string, presenter = false) {
  if (/^\/(admin|dashboard|login|auth|api)(?:\/|$)/.test(path)) return false;
  if (
    /^\/tournaments\/[^/]+\/(team(?:\/|$)|draft\/(captain|overlay)(?:\/|$))/.test(
      path,
    )
  )
    return false;
  return !(presenter && /^\/tournaments\/[^/]+\/draft$/.test(path));
}
