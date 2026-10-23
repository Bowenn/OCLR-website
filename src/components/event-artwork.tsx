"use client";
import { useAppTranslations } from "@/i18n/shared";

import Image from "next/image";
import { useState } from "react";
export function EventArtwork({ src, name }: { src: string; name: string }) {
  const tr = useAppTranslations();

  const [failed, setFailed] = useState(false);
  return (
    <div className="event-artwork">
      {failed ? (
        <div className="event-artwork-fallback">
          <span>OCLR</span>
          <p>{name}</p>
        </div>
      ) : (
        <Image
          src={src}
          alt={tr("{value0} key visual", { value0: name })}
          width={1672}
          height={941}
          sizes="(max-width: 1360px) 100vw, 55vw"
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
