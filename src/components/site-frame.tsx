"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { isPublicPage } from "@/lib/public-navigation";
export function SiteFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  return (
    <div
      className={`site-shell ${isPublicPage(path, query.get("presenter") === "1") ? "public-site" : "private-site"}`}
    >
      {children}
    </div>
  );
}
