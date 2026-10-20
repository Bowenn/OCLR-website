"use client";
import { localDateTime, zonedInstants } from "@/lib/edition-time";
export function ZonedDateInput({
  label,
  value,
  timeZone,
  onChange,
  optional = false,
}: {
  label: string;
  value: string | null;
  timeZone: string;
  onChange: (value: string | null) => void;
  optional?: boolean;
}) {
  const local = value
    ? /Z$|[+-]\d{2}:\d{2}$/.test(value)
      ? localDateTime(value, timeZone)
      : value
    : "";
  const candidates = local ? zonedInstants(local, timeZone) : [];
  return (
    <div className="form-stack">
      <label className="field">
        <span>
          {label} ({timeZone}){optional ? " · optional / TBA" : ""}
        </span>
        <input
          type="datetime-local"
          value={local}
          onChange={(e) => {
            const values = zonedInstants(e.target.value, timeZone);
            onChange(values.length === 1 ? values[0] : e.target.value || null);
          }}
        />
      </label>
      {local && !candidates.length && (
        <p role="alert" className="error-text small">
          This local time does not exist in {timeZone}. Check the date or clock
          change.
        </p>
      )}
      {candidates.length > 1 && (
        <label className="field">
          <span>{label}: clock-change offset</span>
          <select
            value={candidates.includes(value ?? "") ? value! : ""}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">Choose the intended offset</option>
            {candidates.map((v) => (
              <option key={v} value={v}>
                {new Intl.DateTimeFormat("en", {
                  timeZone,
                  timeZoneName: "longOffset",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(v))}{" "}
                · {v}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
