import { LAW_BOOKS, type BookScope } from "@/lib/sajilokanun/lawbooks";

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
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-3xl">
        ⚖️
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">
        Nepali law, cited clearly
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Ask about Muluki Ain provisions in Nepali or English. Pick a book or
        leave on Auto to search all indexed acts.
      </p>

      <div className="mt-8 w-full max-w-lg">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Try an example
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(example.query, example.book)}
              className="chip disabled:cursor-not-allowed disabled:opacity-50"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid w-full max-w-lg gap-2 text-left sm:grid-cols-2">
        {LAW_BOOKS.map((book) => (
          <div
            key={book.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--muted)]"
          >
            <span className="font-medium text-[var(--foreground)]">
              {book.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
