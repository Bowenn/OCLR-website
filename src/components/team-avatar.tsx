"use client";
import Image from "next/image";
import { useState } from "react";
export function TeamAvatar({
  team,
}: {
  team: { id: string; name: string; avatarKey?: string | null };
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="team-monogram" aria-hidden="true">
      {team.avatarKey && failed !== team.avatarKey ? (
        <Image
          src={`/api/teams/${team.id}/avatar?v=${team.avatarKey}`}
          width={64}
          height={64}
          unoptimized
          alt=""
          onError={() => setFailed(team.avatarKey!)}
        />
      ) : (
        team.name.trim().slice(0, 2).toLocaleUpperCase()
      )}
    </span>
  );
}
