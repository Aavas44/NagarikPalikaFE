"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./SheetSelect.module.css";

export type SheetSelectOption = {
  value: string;
  label: string;
};

export function SheetSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
}: {
  label?: string;
  value: string;
  options: SheetSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { locale } = useLanguage();
  const closeLabel = locale === "ne" ? "बन्द गर्नुहोस्" : "Close";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedButton = document.querySelector<HTMLButtonElement>(
      `[data-sheet-option="${CSS.escape(value)}"]`
    );
    selectedButton?.focus();
  }, [open, value]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerValue}>
          {selected?.label || placeholder}
        </span>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {mounted &&
        open &&
        createPortal(
          <>
            <button
              type="button"
              className={styles.backdrop}
              aria-label={closeLabel}
              onClick={() => setOpen(false)}
            />
            <div
              className={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={label ? titleId : undefined}
            >
              <div className={styles.sheetHeader}>
                <h4 id={titleId} className={styles.sheetTitle}>
                  {label || placeholder}
                </h4>
                <button
                  type="button"
                  className={styles.sheetClose}
                  onClick={() => setOpen(false)}
                >
                  {closeLabel}
                </button>
              </div>
              <div className={styles.options} role="listbox">
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-sheet-option={option.value}
                      className={`${styles.option} ${
                        isSelected ? styles.optionSelected : ""
                      }`}
                      onClick={() => choose(option.value)}
                    >
                      <span>{option.label}</span>
                      {isSelected ? (
                        <svg
                          className={styles.check}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
