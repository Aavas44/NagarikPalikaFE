"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CaseRowMenu.module.css";

export function CaseRowMenu({
  disabled,
  exportLabel,
  exportingLabel,
  exporting,
  onExport,
  menuLabel,
}: {
  disabled?: boolean;
  exportLabel: string;
  exportingLabel: string;
  exporting: boolean;
  onExport: () => void;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        disabled={disabled || exporting}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ⋯
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={exporting}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onExport();
            }}
          >
            {exporting ? exportingLabel : exportLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
