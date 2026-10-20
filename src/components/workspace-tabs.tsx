"use client";
import { useEffect } from "react";
// Each tab group has one active panel and supports the standard arrow/Home/End keys.
export function WorkspaceTabs<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  // Reveal a restored/deep-linked tab horizontally without moving the page.
  useEffect(() => {
    const tab = document.getElementById(`${id}-${value}`);
    const strip = tab?.parentElement;
    if (!tab || !strip) return;
    const itemBounds = tab.getBoundingClientRect();
    const stripBounds = strip.getBoundingClientRect();
    if (itemBounds.left < stripBounds.left)
      strip.scrollLeft += itemBounds.left - stripBounds.left;
    else if (itemBounds.right > stripBounds.right)
      strip.scrollLeft += itemBounds.right - stripBounds.right;
  }, [id, value]);
  return (
    <div className="workspace-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          type="button"
          role="tab"
          id={`${id}-${item.value}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          key={item.value}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onChange(items[next].value);
            document.getElementById(`${id}-${items[next].value}`)?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
