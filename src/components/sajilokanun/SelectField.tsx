"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectFieldProps<T extends string> = {
  id?: string;
  label: string;
  value: T;
  options: SelectOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
  /** Widen the menu beyond the trigger (useful for long Nepali book titles). */
  menuMinWidth?: number;
};

const DESKTOP_MENU_MAX_HEIGHT = 240;

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  disabled = false,
  onChange,
  menuMinWidth,
}: SelectFieldProps<T>) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [desktopStyle, setDesktopStyle] = useState<CSSProperties>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || isMobile || !triggerRef.current) {
      setDesktopStyle(undefined);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = Math.min(
        DESKTOP_MENU_MAX_HEIGHT,
        options.length * 44 + 12
      );
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUpward =
        spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const width = Math.max(rect.width, menuMinWidth ?? rect.width);
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - width - 12
      );

      if (openUpward) {
        setDesktopStyle({
          position: "fixed",
          left,
          width,
          bottom: window.innerHeight - rect.top + 4,
          maxHeight: Math.min(DESKTOP_MENU_MAX_HEIGHT, spaceAbove),
        });
      } else {
        setDesktopStyle({
          position: "fixed",
          left,
          width,
          top: rect.bottom + 4,
          maxHeight: Math.min(DESKTOP_MENU_MAX_HEIGHT, spaceBelow),
        });
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, isMobile, menuMinWidth, options.length]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    if (isMobile) {
      document.body.style.overflow = "hidden";
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isMobile]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleSelect(next: T) {
    onChange(next);
    close();
  }

  const desktopReady = isMobile || desktopStyle !== undefined;

  const menu =
    open && mounted && desktopReady
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[80] bg-black/40 sm:bg-black/20"
              onClick={close}
            />
            <div
              role="listbox"
              aria-label={label}
              style={isMobile ? undefined : desktopStyle}
              className={
                isMobile
                  ? "fixed inset-x-0 bottom-0 z-[90] max-h-[min(70dvh,32rem)] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]"
                  : "z-[90] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]"
              }
            >
              {isMobile && (
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--primary)]"
                  >
                    Done
                  </button>
                </div>
              )}
              <ul className="space-y-1">
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option.value)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-base transition-colors sm:rounded-lg sm:py-2.5 sm:text-sm ${
                          isSelected
                            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 leading-snug">
                          {option.label}
                        </span>
                        {isSelected && (
                          <CheckIcon className="h-5 w-5 shrink-0 text-[var(--primary)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]"
      >
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="input-field flex min-h-[44px] w-full items-center justify-between gap-2 py-2.5 text-left text-base disabled:opacity-50 sm:text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">{selected?.label ?? "Select…"}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {menu}
    </div>
  );
}
