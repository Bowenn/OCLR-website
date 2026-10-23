/** Use cached official country codes only; unknown regions have no flag. */
export function countryFlagData(
  code: string | null | undefined,
  locale: string,
) {
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "ZZ") return null;
  try {
    const name = new Intl.DisplayNames([locale], {
      type: "region",
      fallback: "none",
    }).of(code);
    if (!name || name === code) return null;
    return {
      name,
      flag: String.fromCodePoint(
        ...[...code].map((letter) => 127397 + letter.charCodeAt(0)),
      ),
    };
  } catch {
    return null;
  }
}
