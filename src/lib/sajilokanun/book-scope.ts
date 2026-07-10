import {
  ALL_LAW_BOOK_IDS,
  filenameMatchesScope,
  LAW_BOOKS,
  type BookScope,
} from "./lawbooks";

export type NormalizeBookRequest = {
  /** Single book id, or "auto" for all indexed books. */
  bookScope: BookScope;
  /** All book ids in scope (4 when auto). */
  bookIds: string[];
};

/** Parse normalize-query `book` / `books` — auto expands to all 4 lawComission books. */
export function parseNormalizeBookRequest(
  book: unknown,
  books?: unknown
): NormalizeBookRequest {
  if (Array.isArray(books) && books.length > 0) {
    const ids = books
      .map((b) => (typeof b === "string" ? b.trim() : ""))
      .filter((id) => id && isValidBookId(id));
    const unique = [...new Set(ids)];
    if (unique.length === 1) {
      return { bookScope: unique[0], bookIds: unique };
    }
    if (
      unique.length === ALL_LAW_BOOK_IDS.length &&
      ALL_LAW_BOOK_IDS.every((id) => unique.includes(id))
    ) {
      return { bookScope: "auto", bookIds: ALL_LAW_BOOK_IDS };
    }
    if (unique.length > 0) {
      return { bookScope: unique[0], bookIds: unique };
    }
  }

  const parsed = parseBookScope(book, books);
  if (parsed === "auto") {
    return { bookScope: "auto", bookIds: ALL_LAW_BOOK_IDS };
  }
  if (Array.isArray(parsed)) {
    return { bookScope: parsed[0], bookIds: parsed };
  }
  return { bookScope: parsed, bookIds: [parsed] };
}

/** One or two explicit LAW_BOOKS ids from the frontend. */
export type ExplicitBookScope = string[];

export type ParsedBookScope = BookScope | ExplicitBookScope;

const VALID_BOOK_IDS = new Set(LAW_BOOKS.map((b) => b.id));

export function isValidBookId(id: string): boolean {
  return VALID_BOOK_IDS.has(id);
}

/** Parse API `book` / `books` into auto, a single id, or 1–2 ids. */
export function parseBookScope(
  book: unknown,
  books?: unknown
): ParsedBookScope {
  if (Array.isArray(books) && books.length > 0) {
    const ids = books
      .map((b) => (typeof b === "string" ? b.trim() : ""))
      .filter((id) => id && isValidBookId(id))
      .slice(0, 2);
    if (ids.length > 0) return ids;
  }

  if (typeof book === "string") {
    const trimmed = book.trim();
    if (!trimmed || trimmed === "auto") return "auto";
    if (isValidBookId(trimmed)) return trimmed;
  }

  return "auto";
}

/** Null when scope is auto — otherwise 1–2 book ids for RPC metadata filter. */
export function targetBookIds(scope: ParsedBookScope): string[] | null {
  if (scope === "auto") return null;
  if (Array.isArray(scope)) {
    return scope.length > 0 ? scope : null;
  }
  return [scope];
}

export function isExplicitBookScope(
  scope: ParsedBookScope
): scope is ExplicitBookScope {
  return Array.isArray(scope);
}

/** Primary book for single-book hint filtering (first of multi-select). */
export function primaryBookId(scope: ParsedBookScope): BookScope {
  if (scope === "auto") return "auto";
  if (Array.isArray(scope)) return scope[0] ?? "auto";
  return scope;
}

export function filenameMatchesAnyBookScope(
  filename: string,
  scope: ParsedBookScope
): boolean {
  if (scope === "auto") return true;
  const ids = Array.isArray(scope) ? scope : [scope];
  return ids.some((id) => filenameMatchesScope(filename, id));
}

export function validateBooksRequest(books: unknown): {
  ok: boolean;
  error?: string;
  ids?: string[];
} {
  if (!Array.isArray(books)) {
    return { ok: false, error: "books must be an array" };
  }
  if (books.length === 0) {
    return { ok: false, error: "books must contain at least one id" };
  }
  if (books.length > 2) {
    return { ok: false, error: "At most 2 books allowed" };
  }
  const ids: string[] = [];
  for (const raw of books) {
    if (typeof raw !== "string") {
      return { ok: false, error: "Each book id must be a string" };
    }
    const id = raw.trim();
    if (!isValidBookId(id)) {
      return { ok: false, error: `Unknown book id: ${id}` };
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return { ok: true, ids };
}
