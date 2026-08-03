"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  adminFetchTeams,
  type AdminTeam,
} from "@/lib/sajilokanun-access";
import styles from "@/app/admin.module.css";

type FirmSearchSelectProps = {
  value: string;
  selectedLabel?: string;
  onChange: (firmId: string, firmName: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function FirmSearchSelect({
  value,
  selectedLabel = "",
  onChange,
  disabled = false,
  required = false,
}: FirmSearchSelectProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [displayLabel, setDisplayLabel] = useState(selectedLabel);

  useEffect(() => {
    setDisplayLabel(selectedLabel);
  }, [selectedLabel, value]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const teams = await adminFetchTeams({
            search: query.trim() || undefined,
          });
          if (!cancelled) setResults(teams);
        } catch (err) {
          if (!cancelled) {
            setResults([]);
            setError(err instanceof Error ? err.message : "Failed to search firms");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.skFirmSearch} ref={wrapRef}>
      <input
        type="text"
        className={styles.filterInput}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required={required}
        disabled={disabled}
        placeholder={displayLabel || "Search firms by name…"}
        value={open ? query : displayLabel || ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
        }}
      />
      {value && !open ? (
        <input type="hidden" value={value} readOnly />
      ) : null}
      {open ? (
        <div className={styles.skFirmSearchMenu} id={listId} role="listbox">
          {loading ? (
            <div className={styles.skFirmSearchStatus}>Searching firms…</div>
          ) : error ? (
            <div className={styles.skFirmSearchStatus}>{error}</div>
          ) : results.length === 0 ? (
            <div className={styles.skFirmSearchStatus}>No firms found</div>
          ) : (
            results.map((firm) => (
              <button
                key={firm.id}
                type="button"
                role="option"
                aria-selected={firm.id === value}
                className={`${styles.skFirmSearchOption} ${
                  firm.id === value ? styles.skFirmSearchOptionActive : ""
                }`}
                disabled={!firm.active && firm.id !== value}
                onClick={() => {
                  onChange(firm.id, firm.name);
                  setDisplayLabel(
                    firm.active ? firm.name : `${firm.name} (inactive)`
                  );
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{firm.name}</span>
                <small>
                  {firm.active ? "Active" : "Inactive"}
                  {typeof firm.memberCount === "number"
                    ? ` · ${firm.memberCount} people`
                    : ""}
                </small>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
