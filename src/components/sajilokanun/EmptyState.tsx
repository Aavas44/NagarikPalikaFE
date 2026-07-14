"use client";

import { LAW_BOOKS, type BookScope } from "@/lib/sajilokanun/lawbooks";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";
import styles from "./EmptyState.module.css";

const EXAMPLE_QUERIES = [
  { label: "दफा २", query: "dafa 2", book: "civil-procedure" as BookScope },
  { label: "दफा १००", query: "dafa 100", book: "civil-procedure" as BookScope },
  {
    label: "हत्या — सजाय",
    query: "हत्या गरेमा कस्तो सजाय हुन्छ?",
    book: "auto" as BookScope,
  },
  {
    label: "What is theft?",
    query: "What is the punishment for theft?",
    book: "auto" as BookScope,
  },
];

type EmptyStateProps = {
  onSelect: (query: string, book: BookScope) => void;
  disabled?: boolean;
};

export function EmptyState({ onSelect, disabled }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.title}>Nepali law, cited clearly</h2>
      <p className={pageStyles.calculatorSubtitle}>
        Ask about Muluki Ain provisions in Nepali or English. Pick a book or leave
        on Auto to search all indexed acts.
      </p>

      <div className={styles.examples}>
        <p className={emiStyles.emiFieldHint}>Try an example</p>
        <div className={emiStyles.emiPresets}>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(example.query, example.book)}
              className={emiStyles.emiPreset}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.books}>
        {LAW_BOOKS.map((book) => (
          <li key={book.id}>{book.title}</li>
        ))}
      </ul>
    </div>
  );
}
