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
