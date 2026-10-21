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

/** Resolve completed fields only; undefined means the caller must not save. */
export function dateTimeDraft(
  date: string,
  time: string,
  timeZone: string,
  original: string | null,
  optional: boolean,
  offset = "",
) {
  const invalid = (error: string, candidates: string[] = []) => ({
    value: undefined,
    error,
    candidates,
  });
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    return invalid("Enter a valid IANA time zone.");
  }
  if (!date && !time && optional)
    return { value: null, error: "", candidates: [] };
  if (!date || !time) return invalid("Enter both a date and a time.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    return invalid("Enter a valid calendar date.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return invalid("Use 24-hour HH:mm, from 00:00 to 23:59.");
  const local = `${date}T${time}`;
  const candidates = zonedInstants(local, timeZone);
  if (!candidates.length)
    return invalid(
      "This local time does not exist. Choose a time outside the clock change.",
    );
  // Retain the exact saved representation, seconds and offset on a no-op edit.
  if (
    (!offset ||
      Math.floor(Date.parse(offset) / 60000) ===
        Math.floor(Date.parse(original ?? "") / 60000)) &&
    original &&
    Number.isFinite(Date.parse(original)) &&
    localDateTime(original, timeZone) === local
  )
    return { value: original, error: "", candidates };
  if (candidates.length > 1 && !candidates.includes(offset))
    return invalid(
      "This time occurs twice. Choose the intended UTC offset.",
      candidates,
    );
  return {
    value: candidates.length === 1 ? candidates[0] : offset,
    error: "",
    candidates,
  };
}
