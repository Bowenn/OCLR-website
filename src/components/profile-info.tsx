"use client";

import { useId, useRef, type ReactNode } from "react";

export function ProfileInfo({
  label,
  children,
  inline = false,
}: {
  label: string;
  children: ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  return (
    <>
      <button
        type="button"
        className={`profile-info-trigger${inline ? " profile-info-inline" : ""}`}
        aria-label={label}
        title={label}
        popoverTarget={id}
        onClick={(event) => {
          if (!panel.current) return;
          const rect = event.currentTarget.getBoundingClientRect();
          panel.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 372))}px`;
          panel.current.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - Math.min(420, window.innerHeight - 24)))}px`;
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7v1" />
        </svg>
      </button>
      <div
        id={id}
        ref={panel}
        popover="auto"
        className="profile-info-popover"
        aria-label={label}
      >
        {children}
      </div>
    </>
  );
}
