"use client";
import Image from "next/image";
import { useState } from "react";
export function BeatmapCover({ setId }: { setId: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="beatmap-cover">
      {failed ? (
        <span aria-hidden="true">OCLR</span>
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
