import type { EditionConfiguration } from "./editions";

/** Resolve only against the submitted revision; never today's question labels. */
export function applicationAnswers(
  answers: Record<string, string>,
  configuration: Pick<EditionConfiguration, "registration"> | null | undefined,
) {
  return Object.entries(answers).map(([id, answer]) => {
    const question = configuration?.registration?.questions.find(
      (q) => q.id === id,
    );
    const choice = question?.type === "single_choice" && answer;
    return {
      id,
      label: question?.label ?? id,
      value: choice
        ? (question.options.find((option) => option.id === answer)?.label ??
          answer)
        : answer,
      optionId: choice ? answer : null,
    };
  });
}
