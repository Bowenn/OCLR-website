/** Wall-clock fields are interpreted in the edition's IANA zone, never the browser's zone. */
export function localDateTime(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function zonedInstants(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return [];
  const naive = Date.parse(`${local}:00Z`);
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 16) !== local
  )
    return [];
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = naive + hours * 3600000;
    offsets.add(
      Date.parse(
        `${localDateTime(new Date(sample).toISOString(), timeZone)}:00Z`,
      ) - sample,
    );
  }
  return [
    ...new Set(
      [...offsets]
        .map((offset) => new Date(naive - offset).toISOString())
        .filter((value) => localDateTime(value, timeZone) === local),
    ),
  ].sort();
}
