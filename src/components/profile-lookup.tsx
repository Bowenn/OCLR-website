"use client";
import { useState } from "react";
import { PlayerProfile } from "./player-profile";
import {
  modeNames,
  profileModes,
  type ProfileSnapshot,
} from "@/lib/osu-profile-model";
export function ProfileLookup() {
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setSnapshot(null);
          const form = new FormData(event.currentTarget);
          try {
            const response = await fetch("/api/admin/profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                input: form.get("input"),
                ...(form.get("mode") ? { mode: form.get("mode") } : {}),
                refresh: form.get("refresh") === "on",
              }),
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error ?? "Profile lookup failed.");
            setSnapshot(data);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Profile lookup failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>osu! ID or profile URL</span>
          <input
            name="input"
            required
            maxLength={300}
            placeholder="https://osu.ppy.sh/users/651307/osu"
          />
        </label>
        <div className="field">
          <label htmlFor="lookup-ruleset">Ruleset</label>
          <select id="lookup-ruleset" name="mode">
            <option value="">Use URL ruleset (otherwise osu!)</option>
            {profileModes.map((mode) => (
              <option key={mode} value={mode}>
                {modeNames[mode]}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input name="refresh" type="checkbox" /> Request refresh (throttled)
        </label>
        <button disabled={busy}>
          {busy ? "Loading profile…" : "Look up profile"}
        </button>
      </form>
      {error && (
        <p role="alert" className="notice spaced">
          {error}
        </p>
      )}
      {snapshot && (
        <div className="spaced">
          <PlayerProfile snapshot={snapshot} />
        </div>
      )}
    </>
  );
}
