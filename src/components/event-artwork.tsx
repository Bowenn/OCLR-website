"use client";
import Image from "next/image";
import { useState } from "react";
export function EventArtwork({ src, name }: { src: string; name: string }) {
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
          alt={`${name} key visual`}
          width={1672}
          height={941}
          sizes="(max-width: 760px) 100vw, 55vw"
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
