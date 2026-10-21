import { createTranslator, type TranslationValues } from "next-intl";
import source from "../../messages/en.json" with { type: "json" };

// Translate only explicit interface messages; authored tournament content is literal.
const keys = new Map(
  Object.entries(source.ui)
    .filter(([key]) => /^m[a-f0-9]{12}$/.test(key))
    .map(([key, value]) => [value as string, key]),
);
export type NativeTranslator = (
  key: string,
  values?: TranslationValues,
) => string;
export function appTranslator(t: NativeTranslator, locale: string) {
  return Object.assign(
    (message: string, values?: TranslationValues) => {
      // Legacy parameterized validation errors carry authored values, which
      // must remain literal while the surrounding interface is translated.
      const answer = /^Check your answer to “([\s\S]*)”\.$/.exec(message);
      if (answer) return t("application_answer_error", { question: answer[1] });
      const row = /^Row (\d+): ([\s\S]*)$/.exec(message);
      if (row) {
        const detail = keys.get(row[2]);
        return t("batch_row_error", {
          row: Number(row[1]),
          error: detail ? t(detail) : row[2],
        });
      }
      const key = Object.hasOwn(source.ui, message)
        ? message
        : keys.get(message);
      return key ? t(key, values) : message;
    },
    { locale },
  );
}
const en = createTranslator({ locale: "en", messages: source.ui });
export const english = appTranslator(
  (key, values) => en(key as keyof typeof source.ui, values),
  "en-GB",
);
export type AppTranslator = ReturnType<typeof appTranslator>;
