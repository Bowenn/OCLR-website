"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  availableTimeZones,
  commonTimeZones,
  searchTimeZones,
  timeZoneLabel,
} from "@/lib/time-zones";
export function TimeZonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (zone: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const preferred = [...new Set([value, ...commonTimeZones])];
  const options = searchTimeZones(
    [
      ...preferred.filter((zone) => zones.includes(zone)),
      ...zones.filter((zone) => !preferred.includes(zone)),
    ],
    query,
  );
  const common = options.filter((zone) => preferred.includes(zone));
  const other = options.filter((zone) => !preferred.includes(zone));
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id, query]);
  function choose(zone: string) {
    onChange(zone);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="time-zone-picker field"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`}>Time zone</span>
      <button
        type="button"
        ref={trigger}
        className="secondary time-zone-trigger"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-choices`}
        onClick={() => {
          setZones(availableTimeZones(value));
          setQuery("");
          setActive(0);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setZones(availableTimeZones(value));
            setQuery("");
            setActive(0);
            setOpen(true);
          }
        }}
      >
        {timeZoneLabel(value)}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="time-zone-search">
          <input
            ref={input}
            role="combobox"
            aria-label="Search time zones"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${id}-choices`}
            aria-activedescendant={
              options[active] ? `${id}-option-${active}` : undefined
            }
            autoComplete="off"
            placeholder="Search city or region"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                if (options.length)
                  setActive(
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? options.length - 1
                        : (active +
                            (event.key === "ArrowDown" ? 1 : -1) +
                            options.length) %
                          options.length,
                  );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (options[active]) choose(options[active]);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                trigger.current?.focus();
              }
              if (event.key === "Tab") setOpen(false);
            }}
          />
          <div
            id={`${id}-choices`}
            role="listbox"
            aria-label="Time zones"
            className="time-zone-options"
          >
            {(
              [
                ["Selected & common", common],
                ["All time zones", other],
              ] as const
            ).map(
              ([label, list]) =>
                list.length > 0 && (
                  <div role="group" aria-label={label} key={label}>
                    <div className="time-zone-group" aria-hidden="true">
                      {label}
                    </div>
                    {list.map((zone) => {
                      const index = options.indexOf(zone);
                      return (
                        <div
                          key={zone}
                          id={`${id}-option-${index}`}
                          role="option"
                          aria-selected={value === zone}
                          data-active={active === index || undefined}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => choose(zone)}
                        >
                          {timeZoneLabel(zone)}
                        </div>
                      );
                    })}
                  </div>
                ),
            )}
          </div>
          {!options.length && (
            <p className="small muted" role="status">
              No matching time zones.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
