export type Theme = "light" | "dark";
export const themeCookie = "oclr-theme";
export function readTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
export const appearances = ["default", "cute-pastel"] as const;
export type Appearance = (typeof appearances)[number];
export const appearanceCookie = "oclr-appearance";
export function readAppearance(value: string | undefined): Appearance {
  return value === "cute-pastel" ? "cute-pastel" : "default";
}
