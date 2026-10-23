/** Deterministic Unicode anchors; duplicate/colliding headings never duplicate IDs. */
export function rulesSectionIds(headings: string[]) {
  const used = new Set<string>();
  return headings.map((heading) => {
    const base =
      "rule-" +
      (heading
        .normalize("NFKC")
        .toLocaleLowerCase("en")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "section");
    let id = base,
      suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  });
}

/** Archival punctuation stays in headings and anchors; only TOC labels are cleaned. */
export function rulesContentsLabel(heading: string, archiveSeason?: string) {
  return ["8", "9", "10"].includes(archiveSeason ?? "")
    ? heading.replace(/[:：]+\s*$/u, "")
    : heading;
}

/** Normalize rendered S8 fragments after matching the unchanged figure anchors. */
export function rulesBodyText(text: string, archiveSeason?: string) {
  return archiveSeason === "8"
    ? text.replace(/\n(?:[ \t]*\n){2,}/g, "\n\n").trim()
    : text.trim();
}
