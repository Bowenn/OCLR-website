import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { refereeMessage } from "../../src/i18n/referee";
import { sourceMessages } from "../../scripts/i18n";
import type { AppTranslator } from "../../src/i18n/translate";

describe("referee interface localization", () => {
  it("extracts the dynamic workflow/readiness messages displayed by the panel", () => {
    const messages = sourceMessages();
    for (const path of ["src/lib/referee-model.ts", "src/lib/referee.ts"]) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(
        /(?:fail|issues\.push|readiness\.push)\(\s*"([^"]+)"/g,
      ))
        expect(messages.has(match[1]), match[1]).toBe(true);
    }
  });
  it("translates conflict structure while preserving the actual step numbers", () => {
    const spy = vi.fn((text: string) => text);
    const tr = Object.assign(spy, { locale: "en" }) as AppTranslator;
    refereeMessage(
      tr,
      "Withdraw conflicting steps in reverse order before changing the order: 2, 12.",
    );
    expect(spy).toHaveBeenCalledWith(
      "Withdraw conflicting steps in reverse order before changing the order: {steps}.",
      { steps: "2, 12" },
    );
  });
  it("maps stored status and event codes to extractable interface labels", () => {
    const spy = vi.fn((text: string) => text);
    const tr = Object.assign(spy, { locale: "en" }) as AppTranslator;
    expect(refereeMessage(tr, "attempt_replayed")).toBe("Replay recorded");
    expect(refereeMessage(tr, "playing")).toBe("In progress");
    expect(refereeMessage(tr, "secondPick")).toBe("Second Pick team");
    expect(refereeMessage(tr, "prepareSeconds")).toBe(
      "Preparation timer seconds",
    );
    expect(sourceMessages().has("Replay recorded")).toBe(true);
  });
});
