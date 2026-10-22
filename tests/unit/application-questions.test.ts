import { describe, expect, it } from "vitest";
import { questionSchema, editionSchema } from "../../src/lib/editions";
import { validateApplication } from "../../src/lib/registrations";
import { applicationAnswers } from "../../src/lib/application-answers";
import { csv } from "../../src/lib/csv";
import { edition } from "../fixtures/edition";
import { applicationQuestions } from "../fixtures/application-questions";

const question = applicationQuestions[1];
const configured = editionSchema.parse({
  ...edition,
  rules: null,
  eligibility: null,
  registration: { ...edition.registration, questions: applicationQuestions },
});
const input = { configurationVersion: 2, answers: { availability: "weekend" } };
describe("versioned text and single-choice application questions", () => {
  it("defaults legacy questions to text without inventing choices", () => {
    expect(
      questionSchema.parse({
        id: "legacy",
        label: "Original",
        required: false,
      }),
    ).toEqual({
      id: "legacy",
      label: "Original",
      required: false,
      type: "text",
      maxLength: 500,
    });
  });
  it.each([null, "checkbox", "radio", "", 1])(
    "rejects unknown question type %s",
    (type) => {
      expect(questionSchema.safeParse({ ...question, type }).success).toBe(
        false,
      );
    },
  );
  it("bounds choice lists, labels, identifiers and question count", () => {
    for (const options of [
      [],
      [{ id: "a", label: "A" }],
      Array.from({ length: 21 }, (_, i) => ({ id: `a${i}`, label: `A${i}` })),
      [
        { id: "a", label: "A" },
        { id: "a", label: "B" },
      ],
      [
        { id: "a", label: " A " },
        { id: "b", label: "A" },
      ],
      [
        { id: "a", label: " " },
        { id: "b", label: "B" },
      ],
      [
        { id: "a", label: "A".repeat(201) },
        { id: "b", label: "B" },
      ],
      [
        { id: "1", label: "A" },
        { id: "b", label: "B" },
      ],
    ]) {
      expect(questionSchema.safeParse({ ...question, options }).success).toBe(
        false,
      );
    }
    expect(
      questionSchema.safeParse({ ...question, maxLength: 10 }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...applicationQuestions[0], options: [] })
        .success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...configured,
        registration: {
          ...configured.registration,
          questions: Array.from({ length: 17 }, (_, i) => ({
            ...question,
            id: `q${i}`,
          })),
        },
      }).success,
    ).toBe(false);
  });
  it("validates exact choice membership and required state while retaining text limits", () => {
    expect(validateApplication(configured, input, 2).answers).toEqual({
      introduction: "",
      availability: "weekend",
      preference: "",
    });
    for (const answer of ["", "removed", " weekend ", "Synthetic evening"]) {
      expect(() =>
        validateApplication(
          configured,
          { ...input, answers: { availability: answer } },
          2,
        ),
      ).toThrow(
        expect.objectContaining({ status: 400, field: "availability" }),
      );
    }
    expect(() =>
      validateApplication(
        configured,
        { ...input, answers: { availability: ["evening", "weekend"] } },
        2,
      ),
    ).toThrow();
    expect(() =>
      validateApplication(
        configured,
        { ...input, answers: { ...input.answers, preference: "forged" } },
        2,
      ),
    ).toThrow(expect.objectContaining({ field: "preference" }));
    expect(() =>
      validateApplication(
        configured,
        {
          ...input,
          answers: { ...input.answers, introduction: "x".repeat(25) },
        },
        2,
      ),
    ).toThrow(expect.objectContaining({ field: "introduction" }));
    expect(() => validateApplication(configured, input, 3)).toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
  it("resolves historical labels literally, preserves unknown history, and records no manual answers", () => {
    expect(
      applicationAnswers(
        { availability: "weekend", introduction: "  literal text  " },
        configured,
      ),
    ).toEqual([
      {
        id: "availability",
        label: "Synthetic availability",
        value: 'Synthetic weekend, "original"',
        optionId: "weekend",
      },
      {
        id: "introduction",
        label: "Synthetic introduction",
        value: "  literal text  ",
        optionId: null,
      },
    ]);
    expect(applicationAnswers({}, configured)).toEqual([]);
    expect(
      applicationAnswers({ legacy: "Original response" }, null)[0].value,
    ).toBe("Original response");
    expect(
      applicationAnswers({ availability: "missing" }, configured)[0].value,
    ).toBe("missing");
    expect(csv([["=question: answer\nnext", 'choice, "quoted"']])).toContain(
      '"\'=question: answer\nnext","choice, ""quoted"""',
    );
  });
});
