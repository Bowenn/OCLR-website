/** The existing public broadcast route; no authentication material or staff URL. */
export function draftOverlayUrl(origin: string, slug: string) {
  const site = new URL(origin);
  if (
    !/^https?:$/.test(site.protocol) ||
    site.username ||
    site.password ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  )
    throw new Error("Invalid overlay origin or edition.");
  return new URL(
    `/tournaments/${encodeURIComponent(slug)}/draft/overlay`,
    site.origin,
  ).href;
}
