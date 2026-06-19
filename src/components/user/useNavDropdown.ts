"use client";

import { useEffect, useRef, useState } from "react";

export function useNavDropdown() {
  const [open, setOpen] = useState(false);
  const [hoverLocked, setHoverLocked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setHoverLocked(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setHoverLocked(false);
        triggerRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      setHoverLocked(!next);
      if (!next) triggerRef.current?.blur();
      return next;
    });
  };

  const onMouseEnter = () => {
    if (!hoverLocked) setOpen(true);
  };

  const onMouseLeave = () => {
    setOpen(false);
    setHoverLocked(false);
  };

  return {
    open,
    rootRef,
    triggerRef,
    toggle,
    onMouseEnter,
    onMouseLeave,
  };
}
