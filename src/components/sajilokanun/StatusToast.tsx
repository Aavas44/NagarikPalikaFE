"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./StatusToast.module.css";

export type StatusToastTone = "success" | "error";

export function StatusToast({
  message,
  tone,
  onDismiss,
  durationMs = 4500,
}: {
  message: string;
  tone: StatusToastTone;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const id = window.setTimeout(() => onDismissRef.current(), durationMs);
    return () => window.clearTimeout(id);
  }, [message, tone, durationMs]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${styles.toast} ${tone === "success" ? styles.success : styles.error}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span className={styles.dot} aria-hidden />
      <p className={styles.message}>{message}</p>
      <button type="button" className={styles.close} onClick={onDismiss} aria-label="Close">
        ×
      </button>
    </div>,
    document.body
  );
}
