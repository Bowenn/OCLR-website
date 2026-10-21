"use client";
import { useAppTranslations } from "@/i18n/shared";

import Image from "next/image";
import { useState } from "react";
export function BeatmapCover({ setId }: { setId: number }) {
  const tr = useAppTranslations();

  const [failed, setFailed] = useState(false);
  return (
    <div className="beatmap-cover">
      {failed ? (
        <span className="muted small">{tr("Cover unavailable")}</span>
      ) : (
        <Image
          src={`https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg`}
          alt=""
          width={180}
          height={100}
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
