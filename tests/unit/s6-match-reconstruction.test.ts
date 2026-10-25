import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("verifies S6 match reconstruction, exclusions and pagination offline", () => {
  const output = execFileSync(
    "python3",
    [
      "-m",
      "unittest",
      "discover",
      "-s",
      "tests/scripts",
      "-p",
      "test_s6_match_reconstruction.py",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  expect(output).toBe("");
});
