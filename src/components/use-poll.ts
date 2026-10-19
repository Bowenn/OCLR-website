"use client";
import { useEffect, useState } from "react";
// One request at a time, complete snapshot replacement, no optimistic events.
export function usePoll<T>(endpoint: string, initial: T | null) {
  const [value, setValue] = useState<T | null>(initial);
  const [connected, setConnected] = useState(true);
  const [authorizationLost, setAuthorizationLost] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    async function update() {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        if ([401, 403].includes(response.status)) {
          if (active) {
            setValue(null);
            setAuthorizationLost(true);
            setConnected(false);
          }
          return;
        }
        if (!response.ok) throw new Error("snapshot");
        const next: T | null = await response.json();
        if (active) {
          setAuthorizationLost(false);
          setValue(next);
          setConnected(true);
        }
      } catch {
        if (active) setConnected(false);
      } finally {
        if (active) timer = setTimeout(update, 2000);
      }
    }
    void update();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [endpoint]);
  return { value, connected, authorizationLost };
}
