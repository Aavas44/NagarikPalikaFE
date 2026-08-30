"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./SheetSelect.module.css";

export type SheetSelectOption = {
  value: string;
  label: string;
  /** Secondary line (e.g. English court name) */
  secondary?: string;
  /** Optional group heading */
  group?: string;
  /** Extra text included in search matching */
  searchText?: string;
};

export function SheetSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
  searchable = false,
  searchPlaceholder,
  emptySearchLabel,
  name,
  required = false,
}: {
  label?: string;
  value: string;
  options: SheetSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  /** Hidden input name for native form required validation */
  name?: string;
  required?: boolean;
}) {
  const { locale } = useLanguage();
  const closeLabel = locale === "ne" ? "बन्द गर्नुहोस्" : "Close";
  const defaultSearchPlaceholder =
    locale === "ne" ? "खोज्नुहोस्…" : "Search…";
  const defaultEmptySearch =
    locale === "ne" ? "कुनै परिणाम भेटिएन" : "No matches found";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = [
        option.label,
        option.secondary,
        option.group,
        option.searchText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SheetSelectOption[]>();
    for (const option of filtered) {
      const key = option.group?.trim() || "";
      const list = map.get(key) ?? [];
      list.push(option);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      if (searchable) searchRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open, searchable]);

  useEffect(() => {
    if (!open || searchable || !value) return;
    const selectedButton = document.querySelector<HTMLButtonElement>(
      `[data-sheet-option="${CSS.escape(value)}"]`
    );
    selectedButton?.focus();
  }, [open, value, searchable]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const triggerLabel = selected
    ? selected.secondary
      ? `${selected.label} · ${selected.secondary}`
      : selected.label
    : placeholder;

  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
          onChange={() => undefined}
        />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerValue}>{triggerLabel}</span>
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
              className={`${styles.sheet} ${
                searchable ? styles.sheetSearchable : ""
              }`}
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

              {searchable ? (
                <div className={styles.searchWrap}>
                  <input
                    ref={searchRef}
                    type="search"
                    className={styles.searchInput}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder || defaultSearchPlaceholder}
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </div>
              ) : null}

              <div className={styles.options} role="listbox">
                {filtered.length === 0 ? (
                  <p className={styles.emptySearch}>
                    {emptySearchLabel || defaultEmptySearch}
                  </p>
                ) : (
                  grouped.map(([groupName, groupOptions]) => (
                    <div key={groupName || "__ungrouped"} className={styles.group}>
                      {groupName ? (
                        <p className={styles.groupLabel}>{groupName}</p>
                      ) : null}
                      {groupOptions.map((option) => {
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
                            <span className={styles.optionText}>
                              <span className={styles.optionLabel}>
                                {option.label}
                              </span>
                              {option.secondary ? (
                                <span className={styles.optionSecondary}>
                                  {option.secondary}
                                </span>
                              ) : null}
                            </span>
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
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
