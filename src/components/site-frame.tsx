"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { isPublicPage, isBroadcastPage } from "@/lib/public-navigation";
export function SiteFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  const presenter = query.get("presenter") === "1";
  const broadcast = isBroadcastPage(path, presenter);
  const publicPage = isPublicPage(path, presenter);
  return (
    <div
      className={`site-shell ${broadcast ? "broadcast-site" : "themed-site"} ${publicPage ? "public-site" : "private-site"}`}
    >
      {children}
    </div>
  );
}
