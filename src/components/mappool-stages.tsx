"use client";
import { useAppTranslations } from "@/i18n/shared";

import { useId, useState, type ReactNode } from "react";
import { WorkspaceTabs } from "./workspace-tabs";

export function MappoolStages({
  stages,
}: {
  stages: { value: "group" | "knockout"; label: string; content: ReactNode }[];
}) {
  const tr = useAppTranslations();

  const id = useId();
  const [selected, setSelected] = useState(stages[0].value);
  const active = stages.find((stage) => stage.value === selected) ?? stages[0];
  return (
    <div className="mappool-browser">
      {stages.length > 1 ? (
        <>
          <WorkspaceTabs
            id={id}
            label={tr("Mappool stages")}
            items={stages}
            value={active.value}
            onChange={setSelected}
          />
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-${active.value}`}
            tabIndex={0}
          >
            <h2 className="sr-only">{active.label}</h2>
            {active.content}
          </div>
        </>
      ) : (
        <>
          <h2 className="mappool-stage-title">{active.label}</h2>
          {active.content}
        </>
      )}
    </div>
  );
}
