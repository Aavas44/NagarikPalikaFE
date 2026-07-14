import type { ReactNode } from "react";
import { parseAdvocateSections } from "@/lib/sajilokanun/advocate-answer-format";
import { formatMuddhaSectionBody } from "@/lib/sajilokanun/devanagari-text";
import {
  parseLegalAnswer,
  type AnswerListItem,
} from "@/lib/sajilokanun/format-legal-answer";
import { cleanAnswerDisplay } from "@/lib/sajilokanun/text-clean";
import styles from "./LegalAnswer.module.css";

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
    <Tag className={`${styles.list} ${nested ? styles.listNested : ""}`}>
      {items.map((item, index) => (
        <li key={`${item.marker}-${index}`} className={styles.listItem}>
          <span className={styles.marker}>{item.marker}</span> {item.text}
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
    return <p className={styles.paragraph}>{content}</p>;
  }

  return (
    <div className={styles.answer}>
      {segments.map((segment, index) => {
        if (segment.type === "source") {
          return (
            <div key={index} className={styles.sourceCallout}>
              <span className="shrink-0 text-[var(--accent)]" aria-hidden>
                📚
              </span>
              <p>
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
            <div key={index} className={styles.metaBox}>
              <p className={styles.metaLabel}>स्रोत विवरण</p>
              <dl className={styles.metaList}>
                {metaLines.map((line, lineIndex) => {
                  const parsed = parseMetaLine(line);
                  if (!parsed) {
                    return (
                      <div key={`${index}-${lineIndex}`} className={styles.metaValue}>
                        {line}
                      </div>
                    );
                  }
                  return (
                    <div key={`${index}-${lineIndex}`} className={styles.metaRow}>
                      <dt className={styles.metaKey}>{parsed.label}</dt>
                      <dd className={styles.metaValue}>{parsed.value}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        }

        if (segment.type === "paragraph") {
          return (
            <p key={index} className={styles.paragraph}>
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
  const advocateSections = parseAdvocateSections(content);

  if (advocateSections) {
    return (
      <div className={styles.advocate}>
        {advocateSections.map((section) => (
          <section key={section.heading}>
            <h3 className={styles.sectionHeading}>{section.heading}</h3>
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
