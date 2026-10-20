"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function ConfirmMutation({
  label,
  title,
  description,
  url,
  payload,
  onSuccess,
  onError,
}: {
  label: string;
  title: string;
  description: string;
  url: string;
  payload: Record<string, unknown>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json();
        const message = result.error ?? "The action could not be completed.";
        setError(message);
        onError?.(message);
        router.refresh();
        return;
      }
      dialog.current?.close();
      onSuccess?.();
      router.refresh();
    } catch {
      const message =
        "Connection interrupted. Refresh to check the saved state before retrying.";
      setError(message);
      onError?.(message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="secondary"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`} className="muted">
          {description}
        </p>
        {error && (
          <p role="alert" className="notice error-text">
            {error}
          </p>
        )}
        <div className="actions">
          <button disabled={pending} onClick={confirm}>
            {pending ? "Saving…" : "Confirm"}
          </button>
          <button
            className="secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </>
  );
}
