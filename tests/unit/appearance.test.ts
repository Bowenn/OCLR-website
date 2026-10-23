import { describe, expect, it } from "vitest";
import {
  appearanceCookie,
  appearances,
  readAppearance,
  readTheme,
} from "../../src/lib/preferences";

describe("visitor appearance preference", () => {
  it("supports only the existing default and optional cute pastel design", () => {
    expect(appearances).toEqual(["default", "cute-pastel"]);
    expect(appearanceCookie).toBe("oclr-appearance");
    expect(readAppearance("cute-pastel")).toBe("cute-pastel");
  });
  it.each([
    undefined,
    "",
    "default",
    "unknown",
    "dark",
    "<script>alert(1)</script>",
    "cute-pastel dark",
  ])(
    "falls back safely for %s without mixing design with brightness",
    (value) => {
      expect(readAppearance(value)).toBe("default");
    },
  );
  it("preserves the independent light/dark preference", () => {
    for (const appearance of appearances) {
      expect(readAppearance(appearance)).toBe(appearance);
      expect(readTheme("dark")).toBe("dark");
      expect(readTheme("light")).toBe("light");
      expect(readTheme("cute-pastel")).toBe("light");
    }
  });
});
