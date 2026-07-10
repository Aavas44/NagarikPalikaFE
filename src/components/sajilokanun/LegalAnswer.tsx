import type { ReactNode } from "react";
import { parseAdvocateSections } from "@/lib/sajilokanun/advocate-answer-format";
import { formatMuddhaSectionBody } from "@/lib/sajilokanun/devanagari-text";
import {
  parseLegalAnswer,
  type AnswerListItem,
} from "@/lib/sajilokanun/format-legal-answer";
import { cleanAnswerDisplay } from "@/lib/sajilokanun/text-clean";

function parseMetaLine(line: string): { label: string; value: string } | null {
  const match = line.match(/^(.+?)\s*:\s*(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

function ListItems({
  items,
  ordered,
  nested = false,
}: {
  items: AnswerListItem[];
  ordered: boolean;
  nested?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={
        nested
          ? "mt-1 list-none space-y-1 border-l-2 border-[var(--border)] pl-4"
          : "mt-2 list-none space-y-2"
      }
    >
      {items.map((item, index) => (
        <li key={`${item.marker}-${index}`} className="leading-relaxed">
          <span className="font-semibold text-[var(--primary)]">{item.marker}</span>{" "}
          {item.text}
          {item.subitems && item.subitems.length > 0 && (
            <ListItems items={item.subitems} ordered={false} nested />
          )}
        </li>
      ))}
    </Tag>
  );
}

function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[var(--primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function cleanSectionBody(heading: string, body: string): string {
  if (heading === "मुद्दा") return formatMuddhaSectionBody(body);
  return cleanAnswerDisplay(body);
}

function LegalAnswerBody({ content }: { content: string }) {
  const segments = parseLegalAnswer(content);

  if (segments.length === 0) {
    return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
  }

  return (
    <div className="space-y-4 leading-relaxed">
      {segments.map((segment, index) => {
        if (segment.type === "source") {
          return (
            <div
              key={index}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)]/40 px-3 py-2 text-sm"
            >
              <span className="shrink-0 text-[var(--accent)]" aria-hidden>
                📚
              </span>
              <p className="leading-snug">
                <span className="font-semibold text-[var(--primary)]">स्रोत:</span>{" "}
                {renderInlineBold(segment.text)}
              </p>
            </div>
          );
        }

        if (segment.type === "meta") {
          const metaLines = segment.text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

          return (
            <div
              key={index}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3"
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent)]">
                स्रोत विवरण
              </p>
              <dl className="space-y-1.5">
                {metaLines.map((line, lineIndex) => {
                  const parsed = parseMetaLine(line);
                  if (!parsed) {
                    return (
                      <div key={`${index}-${lineIndex}`} className="text-sm">
                        {line}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${index}-${lineIndex}`}
                      className="grid gap-0.5 text-sm sm:grid-cols-[9rem_1fr]"
                    >
                      <dt className="font-medium text-[var(--muted)]">
                        {parsed.label}
                      </dt>
                      <dd className="text-[var(--foreground)]">{parsed.value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        }

        if (segment.type === "paragraph") {
          return (
            <p key={index} className="whitespace-pre-wrap text-[15px]">
              {renderInlineBold(segment.text)}
            </p>
          );
        }

        return (
          <ListItems
            key={index}
            items={segment.items}
            ordered={segment.ordered}
          />
        );
      })}
    </div>
  );
}

export function LegalAnswer({ content }: { content: string }) {
  // Split advocate sections on raw markdown BEFORE global clean (which can reorder lines).
  const advocateSections = parseAdvocateSections(content);

  if (advocateSections) {
    return (
      <div className="space-y-6">
        {advocateSections.map((section) => (
          <section key={section.heading}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--primary)]">
              {section.heading}
            </h3>
            <LegalAnswerBody
              content={cleanSectionBody(section.heading, section.body)}
            />
          </section>
        ))}
      </div>
    );
  }

  return <LegalAnswerBody content={cleanAnswerDisplay(content)} />;
}
