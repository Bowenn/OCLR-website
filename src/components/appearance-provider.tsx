"use client";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  inheritedAppearance,
  type AppearanceScope,
} from "@/lib/appearance-scope";
import { readAppearance, type Appearance } from "@/lib/preferences";
const Context = createContext<{
  appearance: Appearance;
  inheritedDefault: Appearance;
  edition: boolean;
  preference: Appearance | undefined;
  choose: (value: Appearance | undefined) => void;
} | null>(null);
export function AppearanceProvider({
  siteDefault,
  scopes,
  initialPreference,
  children,
}: {
  siteDefault: Appearance;
  scopes: AppearanceScope[];
  initialPreference?: Appearance;
  children: ReactNode;
}) {
  const path = usePathname(),
    query = useSearchParams();
  const inherited = inheritedAppearance(path, query, scopes, siteDefault);
  const [choice, setChoice] = useState<{
    value: Appearance | undefined;
    serverValue: Appearance | undefined;
  } | null>(null);
  const preference =
    choice && choice.serverValue === initialPreference
      ? choice.value
      : initialPreference;
  const appearance = readAppearance(preference, inherited.appearance);
  // SSR sets the same attribute. Client navigation updates it before paint,
  // without turning an inherited tournament default into a personal cookie.
  useLayoutEffect(() => {
    document.documentElement.dataset.appearance = appearance;
  }, [appearance, path]);
  return (
    <Context.Provider
      value={{
        appearance,
        inheritedDefault: inherited.appearance,
        edition: inherited.edition,
        preference,
        choose: (value) => setChoice({ value, serverValue: initialPreference }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAppearanceScope = () => useContext(Context);
