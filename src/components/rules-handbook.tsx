"use client";
import { useAppTranslations } from "@/i18n/shared";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { rulesSectionIds } from "@/lib/rules-navigation";
type RuleSection = {
  heading: string;
  body: string;
  figures?: {
    after: string;
    src: string;
    alt: string;
    width: number;
    height: number;
  }[];
};
function RuleBody({ section }: { section: RuleSection }) {
  let offset = 0;
  return (
    <>
      {section.figures?.map((figure) => {
        const start = section.body.indexOf(figure.after, offset);
        if (start < 0) return null;
        const end = start + figure.after.length;
        const text = section.body.slice(offset, end);
        offset = end;
        return (
          <div key={figure.src}>
            <p className="preserve-lines">{text.trim()}</p>
            <figure className="rules-illustration">
              <Image
                src={figure.src}
                alt={figure.alt}
                width={figure.width}
                height={figure.height}
                unoptimized
              />
            </figure>
          </div>
        );
      })}
      {section.body.slice(offset).trim() && (
        <p className="preserve-lines">{section.body.slice(offset).trim()}</p>
      )}
    </>
  );
}
export function RulesHandbook({ sections }: { sections: RuleSection[] }) {
  const tr = useAppTranslations();

  const ids = useMemo(
    () => rulesSectionIds(sections.map((s) => s.heading)),
    [sections],
  );
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-80px 0px -50% 0px" },
    );
    for (const id of ids) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [ids]);
  function contents() {
    return (
      <nav aria-label={tr("Rules contents")}>
        {sections.map((s, i) => (
          <a
            href={`#${ids[i]}`}
            key={ids[i]}
            aria-current={active === ids[i] ? "location" : undefined}
            onClick={(event) => {
              setActive(ids[i]);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            {s.heading}
          </a>
        ))}
      </nav>
    );
  }
  return (
    <div className="rules-handbook">
      <aside className="rules-desktop-contents">
        <p className="eyebrow">{tr("Contents")}</p>
        {contents()}
      </aside>
      <div className="rules-reading">
        <details className="rules-mobile-contents">
          <summary>{tr("On this page")}</summary>
          {contents()}
        </details>
        <article className="rules-article">
          {sections.map((s, i) => (
            <section key={ids[i]} aria-labelledby={ids[i]}>
              <h2 id={ids[i]} tabIndex={-1}>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h2>
              <RuleBody section={s} />
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
