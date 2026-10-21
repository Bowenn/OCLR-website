export type Theme = "light" | "dark";
export const themeCookie = "oclr-theme";
export function readTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
