import type { ApplicationQuestion } from "../../src/lib/editions";

export const applicationQuestions: ApplicationQuestion[] = [
  {
    id: "introduction",
    label: "Synthetic introduction",
    required: false,
    type: "text",
    maxLength: 24,
  },
  {
    id: "availability",
    label: "Synthetic availability",
    required: true,
    type: "single_choice",
    options: [
      { id: "evening", label: "Synthetic evening" },
      { id: "weekend", label: 'Synthetic weekend, "original"' },
    ],
  },
  {
    id: "preference",
    label: "Synthetic optional choice",
    required: false,
    type: "single_choice",
    options: Array.from({ length: 7 }, (_, i) => ({
      id: `option_${i}`,
      label: `Synthetic option ${i + 1}`,
    })),
  },
];
