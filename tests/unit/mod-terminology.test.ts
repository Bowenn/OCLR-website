import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hans from "../../messages/zh-Hans.json";
import hant from "../../messages/zh-Hant.json";
import {
  categoryNames,
  fmModeNames,
  slotLabel,
} from "../../src/lib/mappool-model";
describe("non-translatable osu! mod terminology", () => {
  it("keeps approved names and slot labels literal without changing Chinese pool terminology", () => {
    expect(categoryNames).toEqual({
      NM: "No Mod",
      HD: "Hidden",
      DT: "Double Time",
      HR: "Hard Rock",
      FM: "FM",
      TB: "Tie Breaker",
    });
    for (const [locale, catalog] of [
      ["zh-Hans", hans],
      ["zh-Hant", hant],
    ] as const) {
      for (const [key, source] of Object.entries(en.ui)) {
        const translated = catalog.ui[key as keyof typeof catalog.ui];
        if (
          [
            ...Object.values(categoryNames),
            ...Object.values(fmModeNames),
          ].includes(source as typeof categoryNames.NM)
        )
          expect(translated).toBe(source);
        if (/Free Mod|Force Mod/.test(source)) {
          expect(translated).not.toMatch(/自由模[组組]|[强強]制模[组組]/);
          for (const name of ["Free Mod", "Force Mod"])
            if (source.includes(name)) expect(translated).toContain(name);
        }
        if (source === "Mappools")
          expect(translated).toBe(locale === "zh-Hans" ? "图池" : "圖池");
      }
    }
    expect(slotLabel("TB", 1)).toBe("TB");
    expect(slotLabel("NM", 2)).toBe("NM2");
  });
});
