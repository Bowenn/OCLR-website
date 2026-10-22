"use client";

import { useAppTranslations } from "@/i18n/shared";

import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
export function ConfirmMutation({
  label,
  className = "secondary",
  title,
  description,
  url,
  payload,
  onSuccess,
  onError,
  requireConfirmation = true,
  canConfirm = true,
  disabled = false,
  children,
}: {
  label: string;
  className?: string;
  title: string;
  description?: string;
  url: string;
  payload: Record<string, unknown>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  requireConfirmation?: boolean;
  canConfirm?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const tr = useAppTranslations();

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
        type="button"
        className={className}
        disabled={disabled || pending || (!requireConfirmation && !canConfirm)}
        onClick={() => {
          setError("");
          if (requireConfirmation) dialog.current?.showModal();
          else void confirm();
        }}
      >
        {pending ? tr("Saving…") : tr(label)}
      </button>
      {!requireConfirmation && error && (
        <p role="alert" className="notice error-text">
          {tr(error)}
        </p>
      )}
      {requireConfirmation && (
        <dialog
          ref={dialog}
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-description` : undefined}
          onCancel={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          <h2 id={`${id}-title`}>{tr(title)}</h2>
          {description && (
            <p id={`${id}-description`} className="muted">
              {tr(description)}
            </p>
          )}
          {children}
          {error && (
            <p role="alert" className="notice error-text">
              {tr(error)}
            </p>
          )}
          <div className="actions">
            <button disabled={pending || !canConfirm} onClick={confirm}>
              {pending ? tr("Saving…") : tr("Confirm")}
            </button>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              {tr("Cancel")}
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
