import { dedupeSourcesForDisplay, formatSourceLabel, UI_SOURCES_DISPLAY_MAX } from "@/lib/sajilokanun/source-label";
import { sourcePdfLinkTitle, sourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import type { SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import { toNepaliNumberDisplay } from "@/lib/sajilokanun/nepali-digits";

export type Source = {
  id: string;
  content: string;
  filename: string;
  page_number?: number | null;
  section_label?: string | null;
  section_title?: string | null;
  chapter?: string | null;
  subsection?: string | null;
  similarity: number;
};

type SourcePanelProps = {
  sources: Source[];
  expanded: boolean;
  onToggle: () => void;
  onOpenPdf: (preview: SourcePdfPreview) => void;
};

function relevanceTone(score: number): string {
  if (score >= 0.8) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (score >= 0.5) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function SourcePanel({ sources, expanded, onToggle, onOpenPdf }: SourcePanelProps) {
  const unique = dedupeSourcesForDisplay(sources).slice(0, UI_SOURCES_DISPLAY_MAX);

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--surface-muted)]"
      >
        <span>
          {expanded ? "लुकाउनुहोस्" : "विस्तृत"} स्रोत ({unique.length})
        </span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <ul className="mt-3 space-y-2">
          {unique.map((source, index) => {
            const pct = (source.similarity * 100).toFixed(0);
            const label = formatSourceLabel({ ...source, content: source.content });
            const preview = sourcePdfPreview(source);
            return (
              <li
                key={source.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {preview ? (
                    <button
                      type="button"
                      onClick={() => onOpenPdf(preview)}
                      className="text-left font-medium leading-snug text-[var(--primary)] underline-offset-2 hover:underline"
                      title={sourcePdfLinkTitle(source)}
                    >
                      {index + 1}. {label}
                    </button>
                  ) : (
                    <p className="font-medium leading-snug">
                      {index + 1}. {label}
                    </p>
                  )}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${relevanceTone(source.similarity)}`}
                  >
                    {pct}% match
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                  {source.chapter && <li>{source.chapter}</li>}
                  {source.section_label && (
                    <li>
                      दफा {toNepaliNumberDisplay(source.section_label)}
                      {source.section_title
                        ? ` — ${source.section_title}`
                        : ""}
                    </li>
                  )}
                  {source.subsection && (
                    <li>उपदफा {source.subsection}</li>
                  )}
                </ul>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
                  {source.content.split("\n").slice(1).join(" ").slice(0, 280)}…
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
