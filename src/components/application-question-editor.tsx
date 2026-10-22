"use client";

import { useId } from "react";
import { useAppTranslations } from "@/i18n/shared";
import { questionSchema, type ApplicationQuestion } from "@/lib/editions";

export function ApplicationQuestionEditor({
  question: q,
  index,
  onChange,
}: {
  question: ApplicationQuestion;
  index: number;
  onChange: (question: ApplicationQuestion) => void;
}) {
  const tr = useAppTranslations();
  const errorId = useId();
  const valid = questionSchema.safeParse(q).success;
  return (
    <>
      <label className="field">
        <span>
          {tr("Question ")}
          {index + 1}
          {tr(" label")}
        </span>
        <input
          maxLength={200}
          value={q.label}
          onChange={(event) => onChange({ ...q, label: event.target.value })}
        />
      </label>
      <div className="question-controls">
        <label className="field">
          <span>{tr("Question type")}</span>
          <select
            value={q.type}
            onChange={(event) => {
              const shared = { id: q.id, label: q.label, required: q.required };
              onChange(
                event.target.value === "single_choice"
                  ? {
                      ...shared,
                      type: "single_choice",
                      options: Array.from({ length: 2 }, () => ({
                        id: `option_${crypto.randomUUID().slice(0, 8)}`,
                        label: "",
                      })),
                    }
                  : { ...shared, type: "text", maxLength: 500 },
              );
            }}
          >
            <option value="text">{tr("Text answer")}</option>
            <option value="single_choice">{tr("Single choice")}</option>
          </select>
        </label>
        {q.type === "text" && (
          <label className="field">
            <span>
              {tr("Question ")}
              {index + 1}
              {tr(" maximum length")}
            </span>
            <input
              type="number"
              min={1}
              max={2000}
              value={q.maxLength}
              onChange={(event) =>
                onChange({ ...q, maxLength: Number(event.target.value) })
              }
            />
          </label>
        )}
        <label className="check-field">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(event) =>
              onChange({ ...q, required: event.target.checked })
            }
          />
          <span>
            {tr("Question ")}
            {index + 1}
            {tr(" is required")}
          </span>
        </label>
      </div>
      {q.type === "single_choice" && (
        <div
          className="question-options"
          aria-describedby={!valid ? errorId : undefined}
        >
          {q.options.map((option, i) => (
            <div className="question-option-row" key={option.id}>
              <label className="field">
                <span>{tr("Option {number}", { number: i + 1 })}</span>
                <input
                  maxLength={200}
                  value={option.label}
                  onChange={(event) =>
                    onChange({
                      ...q,
                      options: q.options.map((v) =>
                        v.id === option.id
                          ? { ...v, label: event.target.value }
                          : v,
                      ),
                    })
                  }
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!i}
                  aria-label={tr("Move option {number} up", { number: i + 1 })}
                  onClick={() => {
                    const options = [...q.options];
                    [options[i - 1], options[i]] = [options[i], options[i - 1]];
                    onChange({ ...q, options });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={i === q.options.length - 1}
                  aria-label={tr("Move option {number} down", {
                    number: i + 1,
                  })}
                  onClick={() => {
                    const options = [...q.options];
                    [options[i], options[i + 1]] = [options[i + 1], options[i]];
                    onChange({ ...q, options });
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={q.options.length <= 2}
                  aria-label={tr("Remove option {number}", { number: i + 1 })}
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((v) => v.id !== option.id),
                    })
                  }
                >
                  {tr("Remove")}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={q.options.length >= 20}
            onClick={() =>
              onChange({
                ...q,
                options: [
                  ...q.options,
                  {
                    id: `option_${crypto.randomUUID().slice(0, 8)}`,
                    label: "",
                  },
                ],
              })
            }
          >
            {tr("Add option")}
          </button>
        </div>
      )}
      {!valid && (
        <p id={errorId} className="small error-text" role="status">
          {q.type === "single_choice"
            ? tr("Add a question label and 2–20 distinct, nonempty options.")
            : tr(
                "Add a question label and a maximum length between 1 and 2000.",
              )}
        </p>
      )}
    </>
  );
}
