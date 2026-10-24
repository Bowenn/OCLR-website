"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TournamentStage } from "@/lib/tournament-stages";
import "./tournament-stage-scroll.css";

type Labels = {
  title: string;
  previous: string;
  next: string;
  current: string;
  past: string;
  upcoming: string;
  planned: string;
};

export function TournamentStageScroll({
  stages,
  labels,
}: {
  stages: TournamentStage[];
  labels: Labels;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: true, bottom: stages.length <= 2 });
  const current = stages.findIndex((stage) => stage.state === "current");
  function measure() {
    const element = viewport.current;
    if (element)
      setEdges({
        top: element.scrollTop < 2,
        bottom:
          element.scrollTop + element.clientHeight >= element.scrollHeight - 2,
      });
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const row = element.querySelector<HTMLElement>('[aria-current="step"]');
    if (row)
      element.scrollTop = Math.max(0, row.offsetTop - element.clientHeight / 3);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [current]);
  function scroll(direction: number) {
    const element = viewport.current;
    if (!element) return;
    const row = element.querySelector<HTMLElement>("li");
    element.scrollBy({
      top: direction * (row?.offsetHeight ?? 88),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  return (
    <section className="stage-scroll" aria-label={labels.title}>
      <div className="stage-scroll-heading">
        <h2>{labels.title}</h2>
        <div className="stage-scroll-controls">
          <button
            type="button"
            onClick={() => scroll(-1)}
            disabled={edges.top}
            aria-label={labels.previous}
            aria-controls="tournament-stage-list"
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            disabled={edges.bottom}
            aria-label={labels.next}
            aria-controls="tournament-stage-list"
          >
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
      <div
        className="stage-scroll-viewport"
        id="tournament-stage-list"
        ref={viewport}
        onScroll={measure}
        tabIndex={0}
        role="region"
        aria-label={labels.title}
      >
        <ol>
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className={`stage-scroll-row is-${stage.state}`}
              aria-current={stage.state === "current" ? "step" : undefined}
            >
              <span className="stage-scroll-marker" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="stage-scroll-copy">
                <div className="stage-scroll-title">
                  <h3>{stage.label}</h3>
                  <span className="stage-scroll-status">
                    {labels[stage.state]}
                  </span>
                </div>
                {stage.detail && <p>{stage.detail}</p>}
              </div>
              <Link
                className="stage-scroll-action"
                href={stage.href}
                aria-label={`${stage.label} · ${stage.action}`}
              >
                <span>{stage.action}</span>
                <span aria-hidden="true"> →</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
