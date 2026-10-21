"use client";
import { useEffect, useId, useState } from "react";
import { dateTimeDraft, localDateTime } from "@/lib/edition-time";

export function ZonedDateInput({
  label,
  value,
  timeZone,
  onChange,
  onValidityChange,
  optional = false,
}: {
  label: string;
  value: string | null;
  timeZone: string;
  onChange: (value: string | null) => void;
  onValidityChange: (valid: boolean) => void;
  optional?: boolean;
}) {
  const id = useId();
  function initial() {
    let local = "";
    try {
      if (value) local = localDateTime(value, timeZone);
    } catch {
      /* Inline zone validation below. */
    }
    return {
      source: value,
      zone: timeZone,
      date: local.slice(0, 10),
      time: local.slice(11),
      offset: "",
    };
  }
  const [draft, setDraft] = useState(initial);
  // External changes (including a zone switch) preserve the instant and redisplay
  // its wall clock. Incomplete local edits never replace the controlled value.
  if (draft.source !== value || draft.zone !== timeZone) setDraft(initial());
  const result = dateTimeDraft(
    draft.date,
    draft.time,
    timeZone,
    value,
    optional,
    draft.offset,
  );
  const valid = result.value !== undefined;
  useEffect(() => {
    onValidityChange(valid);
  }, [valid, onValidityChange]);
  function edit(date: string, time: string, offset = "") {
    const next = dateTimeDraft(date, time, timeZone, value, optional, offset);
    setDraft({
      date,
      time,
      offset,
      source: next.value === undefined ? value : next.value,
      zone: timeZone,
    });
    onValidityChange(next.value !== undefined);
    if (next.value !== undefined) onChange(next.value);
  }
  const selectedOffset =
    result.candidates.find(
      (candidate) =>
        value &&
        Math.floor(Date.parse(candidate) / 60000) ===
          Math.floor(Date.parse(value) / 60000),
    ) ?? draft.offset;
  const offset =
    result.value && timeZone !== "UTC"
      ? new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" })
          .formatToParts(new Date(result.value))
          .find((part) => part.type === "timeZoneName")?.value
      : null;
  return (
    <fieldset
      className="zoned-date-input"
      aria-describedby={`${id}-help${result.error ? ` ${id}-error` : ""}`}
    >
      <legend>
        {label}
        {optional ? " (optional)" : ""}
      </legend>
      <div className="zoned-date-fields">
        <label className="field">
          <span className="sr-only">Date</span>
          <input
            aria-label={`${label}: date`}
            type="date"
            required={!optional}
            value={draft.date}
            aria-invalid={!valid}
            aria-describedby={result.error ? `${id}-error` : `${id}-help`}
            onChange={(event) => edit(event.target.value, draft.time)}
          />
        </label>
        <div className="zoned-time">
          <label className="field">
            <span className="sr-only">Time (HH:mm)</span>
            <input
              aria-label={`${label}: time (HH:mm)`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="HH:mm"
              maxLength={5}
              required={!optional}
              value={draft.time}
              aria-invalid={!valid}
              aria-describedby={result.error ? `${id}-error` : `${id}-help`}
              onChange={(event) => {
                const text = event.target.value;
                // Numeric mobile keyboards need no colon key: 1510 → 15:10.
                edit(
                  draft.date,
                  /^\d{4}$/.test(text)
                    ? `${text.slice(0, 2)}:${text.slice(2)}`
                    : text,
                );
              }}
            />
          </label>
          <span id={`${id}-help`} className="zoned-date-zone muted small">
            {timeZone}
            {offset ? ` (${offset})` : ""}
          </span>
          {optional && (
            <button
              type="button"
              className="secondary"
              disabled={!draft.date && !draft.time}
              onClick={() => edit("", "")}
            >
              Clear<span className="sr-only"> {label}</span>
            </button>
          )}
        </div>
      </div>
      {result.candidates.length > 1 && (
        <label className="field zoned-offset">
          <span id={`${id}-offset-label`}>{label}: clock-change offset</span>
          <select
            aria-labelledby={`${id}-offset-label`}
            aria-describedby={result.error ? `${id}-error` : undefined}
            aria-invalid={!valid}
            value={selectedOffset}
            onChange={(event) =>
              edit(draft.date, draft.time, event.target.value)
            }
          >
            <option value="">Choose UTC offset</option>
            {result.candidates.map((instant) => (
              <option key={instant} value={instant}>
                {new Intl.DateTimeFormat("en", {
                  timeZone,
                  timeZoneName: "longOffset",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }).format(new Date(instant))}{" "}
                · {instant}
              </option>
            ))}
          </select>
        </label>
      )}
      {result.error && (
        <p id={`${id}-error`} role="alert" className="error-text small">
          {result.error}
        </p>
      )}
      {value &&
        (new Date(value).getUTCSeconds() !== 0 ||
          new Date(value).getUTCMilliseconds() !== 0) && (
          <p className="muted small">
            Saved seconds are preserved. Changing the date or time sets seconds
            to zero.
          </p>
        )}
    </fieldset>
  );
}
