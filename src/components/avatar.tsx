"use client";
import Image from "next/image";
import { useState } from "react";
export function Avatar({
  osuId,
  username,
}: {
  osuId: number;
  username: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="avatar">
      {failed ? (
        <span aria-hidden="true">{username.slice(0, 2)}</span>
      ) : (
        <Image
          src={`https://a.ppy.sh/${osuId}`}
          alt=""
          width={88}
          height={88}
          unoptimized
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
