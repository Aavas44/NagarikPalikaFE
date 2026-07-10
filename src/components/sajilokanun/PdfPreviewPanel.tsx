"use client";

import { useEffect, useMemo } from "react";
import { lawPdfIframeSrc, type SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";

type PdfPreviewPanelProps = SourcePdfPreview & {
  onClose: () => void;
};

export function PdfPreviewPanel({
  src,
  title,
  page,
  onClose,
}: PdfPreviewPanelProps) {
  const iframeSrc = useMemo(() => lawPdfIframeSrc({ src, title, page }), [src, title, page]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="PDF पूर्वावलोकन बन्द गर्नुहोस्"
        onClick={onClose}
      />

      <aside
        className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col bg-[var(--surface)] shadow-2xl sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-xl sm:border sm:border-[var(--border)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="min-w-0 truncate text-sm font-medium leading-snug">
            {title}
            {page != null && page > 0 ? (
              <span className="ml-2 text-[var(--muted)]">· पृष्ठ {page}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
          >
            बन्द गर्नुहोस्
          </button>
        </header>

        <iframe
          key={iframeSrc}
          src={iframeSrc}
          title={title}
          className="min-h-0 w-full flex-1 border-0 bg-[var(--surface-muted)] sm:rounded-b-xl"
        />
      </aside>
    </div>
  );
}
