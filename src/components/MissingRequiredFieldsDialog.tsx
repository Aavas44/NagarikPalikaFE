"use client";

import { useEffect } from "react";
import styles from "./MissingRequiredFieldsDialog.module.css";

type MissingRequiredFieldsDialogProps = {
  items: string[];
  locale?: "en" | "ne";
  onContinue: () => void;
  onClose: () => void;
};

export function listMissingRequiredLabels(
  fields: Array<{ key: string; required?: boolean; label: string }>,
  values: Record<string, string>
): string[] {
  return fields
    .filter((field) => field.required && !(values[field.key] ?? "").trim())
    .map((field) => field.label);
}

export function MissingRequiredFieldsDialog({
  items,
  locale = "ne",
  onContinue,
  onClose,
}: MissingRequiredFieldsDialogProps) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const title = locale === "ne" ? "अनिवार्य फिल्ड खाली छन्" : "Required fields are empty";
  const intro =
    locale === "ne"
      ? "यी फिल्डहरू भरिएका छैनन्। खाली राखेर पनि अगाडि बढ्न सकिन्छ।"
      : "These required fields are empty. You can continue without filling them.";

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="missing-required-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="missing-required-title">{title}</h2>
        </header>
        <div className={styles.body}>
          <p>{intro}</p>
          <ul className={styles.list}>
            {items.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {locale === "ne" ? "बन्द गर्नुहोस्" : "Close"}
          </button>
          <button type="button" className={styles.continueBtn} onClick={onContinue}>
            {locale === "ne" ? "अगाडि बढ्नुहोस्" : "Continue"}
          </button>
        </footer>
      </div>
    </div>
  );
}
