"use client";
import Image from "next/image";
import { useState } from "react";
export function Avatar({
  osuId,
  username,
  avatarUrl,
}: {
  osuId: number;
  username: string;
  avatarUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="avatar">
      {failed ? (
        <span aria-hidden="true">{username.slice(0, 2)}</span>
      ) : (
        <Image
          src={avatarUrl ?? `https://a.ppy.sh/${osuId}`}
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
