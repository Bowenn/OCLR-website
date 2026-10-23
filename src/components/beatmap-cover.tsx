"use client";
import { useAppTranslations } from "@/i18n/shared";

import { beatmapCoverUrl } from "@/lib/beatmap-artwork";
import Image from "next/image";
import { useState } from "react";
export function BeatmapCover({ setId }: { setId: number | null | undefined }) {
  const tr = useAppTranslations();

  const src = beatmapCoverUrl(setId);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <div className="beatmap-cover">
      {!src || failedSource === src ? (
        <span className="muted small">{tr("Cover unavailable")}</span>
      ) : (
        <Image
          src={src}
          alt=""
          width={180}
          height={100}
          unoptimized
          onError={() => setFailedSource(src)}
        />
      )}
    </div>
  );
}
