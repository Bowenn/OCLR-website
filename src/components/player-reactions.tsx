"use client";
import { useId, useRef, useSyncExternalStore } from "react";
import { useAppTranslations } from "@/i18n/shared";
const presets = [
  "💜",
  "🔥",
  "👏",
  "🐧",
  "✨",
  "💪",
  "😂",
  "😍",
  "🥹",
  "😎",
  "🤔",
  "👀",
  "🎉",
  "🚀",
  "🏆",
  "🥇",
  "🍀",
  "🫶",
  "👍",
  "❤️",
  "🎵",
  "⭐",
  "🌸",
  "🦆",
  "😈",
  "😭",
  "🤯",
  "🙏",
  "💯",
  "🎯",
  "🍵",
  "🐱",
];
const changeEvent = "oclr-player-reactions";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
const serverSnapshot = () => "[]";
export function PlayerReactions({
  playerId,
  edition,
  name,
}: {
  playerId: number;
  edition: string;
  name: string;
}) {
  const tr = useAppTranslations();
  const pickerId = useId();
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const key = `oclr-reactions:${edition}:${playerId}`;
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "[]";
      } catch {
        return "[]";
      }
    },
    serverSnapshot,
  );
  let selected: string[] = [];
  try {
    const value: unknown = JSON.parse(snapshot);
    if (Array.isArray(value))
      selected = value.filter(
        (v): v is string => typeof v === "string" && presets.includes(v),
      );
  } catch {}
  function toggle(emoji: string) {
    const next = selected.includes(emoji)
      ? selected.filter((e) => e !== emoji)
      : [...selected, emoji];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(changeEvent));
    } catch {}
  }
  return (
    <div
      className="player-reactions"
      role="group"
      aria-label={tr("Reactions for {name}", { name })}
    >
      {selected.map((emoji) => (
        <button
          type="button"
          key={emoji}
          className="player-reaction"
          aria-label={tr("React with {emoji}", { emoji })}
          aria-pressed={selected.includes(emoji)}
          onClick={() => toggle(emoji)}
        >
          <span aria-hidden="true">{emoji}</span>
          {selected.includes(emoji) && (
            <span className="reaction-count">1</span>
          )}
        </button>
      ))}
      <button
        ref={trigger}
        type="button"
        className="reaction-add"
        popoverTarget={pickerId}
        aria-label={tr("Add reaction")}
        title={tr("Add reaction")}
        onClick={(event) => {
          const panel = picker.current;
          if (!panel) return;
          const rect = event.currentTarget.getBoundingClientRect();
          panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 284))}px`;
          panel.style.top = `${rect.bottom + 220 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - 212)}px`;
        }}
      >
        ＋
      </button>
      <div
        ref={picker}
        id={pickerId}
        popover="auto"
        className="reaction-picker"
        aria-label={tr("Choose an emoji")}
      >
        <div
          className="reaction-picker-grid"
          role="group"
          aria-label={tr("Choose an emoji")}
        >
          {presets.map((emoji) => (
            <button
              type="button"
              key={emoji}
              aria-label={tr("React with {emoji}", { emoji })}
              aria-pressed={selected.includes(emoji)}
              onClick={() => {
                toggle(emoji);
                picker.current?.hidePopover();
                trigger.current?.focus();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
