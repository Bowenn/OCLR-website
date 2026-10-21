"use client";
import { useEffect, useMemo, useState } from "react";
import { rulesSectionIds } from "@/lib/rules-navigation";
export function RulesHandbook({
  sections,
}: {
  sections: { heading: string; body: string }[];
}) {
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
      <nav aria-label="Rules contents">
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
        <p className="eyebrow">Contents</p>
        {contents()}
      </aside>
      <div className="rules-reading">
        <details className="rules-mobile-contents">
          <summary>On this page</summary>
          {contents()}
        </details>
        <article className="rules-article">
          {sections.map((s, i) => (
            <section key={ids[i]} aria-labelledby={ids[i]}>
              <h2 id={ids[i]} tabIndex={-1}>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h2>
              <p className="preserve-lines">{s.body}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
