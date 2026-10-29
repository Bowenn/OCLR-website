"use client";

import { InfoNote } from "@/components/info-note";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppTranslations } from "@/i18n/shared";
import {
  registrationCountdown,
  type RegistrationState,
} from "@/lib/public-milestones";
export function SeasonCountdown({
  registration,
  state,
  initialNow,
}: {
  registration: {
    opensAt: string;
    closesAt: string;
    opensLabel: string;
    closesLabel: string;
  } | null;
  state: RegistrationState;
  initialNow: number;
}) {
  const tr = useAppTranslations();
  const router = useRouter();
  const [now, setNow] = useState(initialNow);
  const refreshed = useRef("");
  const clock = registrationCountdown(registration, state, now);
  useEffect(() => {
    if (!["upcoming", "open"].includes(state)) return;
    const update = () => setNow(Date.now());
    const id = setInterval(update, 1000);
    const visible = () => {
      if (!document.hidden) update();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [state]);
  const transition =
    clock && clock.phase !== state
      ? `${registration?.opensAt}:${registration?.closesAt}:${clock.phase}`
      : null;
  useEffect(() => {
    if (transition && refreshed.current !== transition) {
      refreshed.current = transition;
      router.refresh();
    }
  }, [transition, router]);
  const title = clock?.target
    ? clock.phase === "upcoming"
      ? tr("Registration opens in")
      : tr("Registration closes in")
    : tr(
        clock?.phase === "closed"
          ? "Registration closed"
          : state === "paused"
            ? "Registration paused"
            : state === "unavailable"
              ? "Registration temporarily unavailable"
              : state === "closed"
                ? "Registration closed"
                : "Registration not announced",
      );
  return (
    <div className="season-countdown">
      <p className="eyebrow">{title}</p>
      {clock?.target && (
        <>
          <div
            className="countdown-units"
            role="timer"
            aria-live="off"
            aria-label={tr("Time remaining")}
          >
            {[
              [clock.days, tr("Days")],
              [clock.hours, tr("Hours")],
              [clock.minutes, tr("Minutes")],
              [clock.seconds, tr("Seconds")],
            ].map(([value, label], index) => (
              <div
                key={label}
                className={index === 0 ? "countdown-days" : undefined}
              >
                <strong>
                  {index === 0 ? value : String(value).padStart(2, "0")}
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <time className="small muted countdown-date" dateTime={clock.target}>
            {clock.phase === "upcoming"
              ? registration?.opensLabel
              : registration?.closesLabel}
          </time>
          <div className="countdown-window">
            <span className="small muted">
              {tr("Registration window elapsed")}
            </span>
            <progress
              max={100}
              value={clock.elapsed}
              aria-label={tr("Registration window elapsed")}
            />
          </div>
        </>
      )}
      {!clock?.target && (
        <InfoNote>
          <p className="muted small">
            {tr("Individual entry. Captain-led team draft.")}
          </p>
        </InfoNote>
      )}
    </div>
  );
}
