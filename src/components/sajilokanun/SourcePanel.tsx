import {
  dedupeSourcesForDisplay,
  formatSourceLabel,
  UI_SOURCES_PANEL_MAX,
} from "@/lib/sajilokanun/source-label";
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
  /** Extra related hit — may not appear in the answer body. */
  related?: boolean;
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
  const unique = dedupeSourcesForDisplay(sources).slice(0, UI_SOURCES_PANEL_MAX);
  const primary = unique.filter((s) => !s.related);
  const related = unique.filter(
    (s) => s.related && Math.round(s.similarity * 100) >= 70
  );
  const ordered = [...primary, ...related];

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3.5 sm:pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-base font-medium text-[var(--primary)] transition-colors hover:bg-[var(--surface-muted)] sm:py-1 sm:text-sm"
      >
        <span>
          {expanded ? "लुकाउनुहोस्" : "विस्तृत"} स्रोत ({ordered.length})
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
          {ordered.map((source, index) => {
            const pct = (source.similarity * 100).toFixed(0);
            const label = formatSourceLabel({ ...source, content: source.content });
            const preview = sourcePdfPreview(source);
            const showRelatedDivider =
              source.related &&
              (index === 0 || !ordered[index - 1]?.related);
            return (
              <li key={source.id}>
                {showRelatedDivider && (
                  <p className="mb-2 mt-1 px-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    अन्य सम्बन्धित स्रोत
                  </p>
                )}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-base sm:p-3.5 sm:text-sm">
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      {source.related ? (
                        <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                          सम्बन्धित
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium sm:px-2 sm:py-0.5 sm:text-xs ${relevanceTone(source.similarity)}`}
                      >
                        {pct}% match
                      </span>
                    </div>
                  </div>
                  <ul className="mt-2.5 space-y-1 text-sm text-[var(--muted)] sm:mt-2 sm:space-y-0.5 sm:text-xs">
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
                  <p className="mt-2.5 line-clamp-4 text-sm leading-relaxed text-[var(--muted)] sm:mt-2 sm:line-clamp-3 sm:text-xs">
                    {source.content.split("\n").slice(1).join(" ").slice(0, 280)}…
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
