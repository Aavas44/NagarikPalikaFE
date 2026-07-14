import { dedupeSourcesForDisplay, formatSourceLabel, UI_SOURCES_DISPLAY_MAX } from "@/lib/sajilokanun/source-label";
import { sourcePdfLinkTitle, sourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import type { SourcePdfPreview } from "@/lib/sajilokanun/source-pdf-link";
import type { Source } from "@/components/sajilokanun/SourcePanel";

type SourceTagsProps = {
  sources: Source[];
  onOpenPdf: (preview: SourcePdfPreview) => void;
};

export function SourceTags({ sources, onOpenPdf }: SourceTagsProps) {
  const deduped = dedupeSourcesForDisplay(sources);
  const unique = (
    deduped.some((source) => !source.related)
      ? deduped.filter((source) => !source.related)
      : deduped
  ).slice(0, UI_SOURCES_DISPLAY_MAX);
  if (unique.length === 0) return null;

  return (
    <div className="mt-3.5 flex flex-wrap gap-2 sm:mt-3 sm:gap-1.5">
      {unique.map((source) => {
        const label = formatSourceLabel({ ...source, content: source.content });
        const preview = sourcePdfPreview(source);
        const className =
          "inline-flex max-w-full items-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm leading-snug text-[var(--foreground)] sm:px-2.5 sm:py-1 sm:text-xs";

        if (preview) {
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onOpenPdf(preview)}
              className={`${className} transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface)] hover:text-[var(--primary)]`}
              title={sourcePdfLinkTitle(source)}
            >
              <span className="mr-1 text-[var(--accent)]" aria-hidden>
                📚
              </span>
              {label}
            </button>
          );
        }

        return (
          <span
            key={source.id}
            className={className}
            title={source.section_title ?? undefined}
          >
            <span className="mr-1 text-[var(--accent)]" aria-hidden>
              📚
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}
