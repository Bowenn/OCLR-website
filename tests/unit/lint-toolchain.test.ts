import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

// Execute rules against invalid source, rather than mistaking a clean lint run
// for proof that the plugins actually ran. No fixture enters the application.
describe("Next ESLint plugin compatibility", () => {
  const eslint = new ESLint();
  it.each([
    ["import/no-anonymous-default-export", "export default {};"],
    [
      "jsx-a11y/alt-text",
      'export function Fixture() { return <img src="/map.png" />; }',
    ],
    [
      "react/jsx-key",
      "export function Fixture() { return [1].map(n => <span>{n}</span>); }",
    ],
    [
      "@typescript-eslint/no-unused-vars",
      "const unused: number = 1; export {};",
    ],
    [
      "@next/next/no-img-element",
      'export function Fixture() { return <img src="/map.png" alt="Map" />; }',
    ],
  ])("executes %s through the production flat config", async (rule, source) => {
    const results = await eslint.lintText(source, {
      filePath: "src/components/lint-toolchain-fixture.tsx",
    });
    const messages = results.flatMap((r) => r.messages);
    expect(messages.some((m) => m.fatal)).toBe(false);
    expect(messages.map((m) => m.ruleId)).toContain(rule);
  });
});
