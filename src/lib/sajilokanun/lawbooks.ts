export type BookScope = "auto" | string;

export type LawBook = {
  id: string;
  title: string;
  /** Filename must match this pattern */
  match: RegExp;
  /** Filename must NOT match (disambiguates e.g. देवानी संहिता vs देवानी कार्यविधि (संहिता)) */
  exclude?: RegExp;
};

/** Known acts — extend when new books are indexed. */
export const LAW_BOOKS: LawBook[] = [
  {
    id: "civil-code",
    title: "मुलुकी देवानी संहिता, २०७४",
    match:
      /देवानी\s*[\(（]?संहिता|संहिता.*देवानी|मुलुकी_देवानी|lawComission\/मुलुकी\s*देवानी\s*संहिता,\s*२०७४/i,
    exclude: /कार्यविधि|karyavidhi/i,
  },
  {
    id: "civil-procedure",
    title: "मुलुकी देवानी कार्यविधि, २०७४",
    match:
      /देवानी.*कार्यविधि|devani.*karyavidhi|lawComission\/मुलुकी\s*देवानी\s*कार्यविधि/i,
  },
  {
    id: "criminal-code",
    title: "मुलुकी अपराध संहिता, २०७४",
    match: /अपराध.*संहिता|aparadh|criminal code/i,
    exclude: /कार्यविधि|procedure/i,
  },
  {
    id: "criminal-procedure",
    title: "मुलुकी फौजदारी कार्यविधि संहिता, २०७४",
    match:
      /फौजदारी.*कार्यविधि|faujdar|faujdari|criminal procedure|lawComission\/मुलुकी\s*फौजदारी\s*कार्यविधि/i,
  },
];

export const ALL_LAW_BOOK_IDS = LAW_BOOKS.map((book) => book.id);

export function bookFilterForScope(scope: BookScope): RegExp | null {
  if (!scope || scope === "auto") return null;
  return LAW_BOOKS.find((book) => book.id === scope)?.match ?? null;
}

export function bookTitleForScope(scope: BookScope): string | null {
  if (!scope || scope === "auto") return null;
  return LAW_BOOKS.find((book) => book.id === scope)?.title ?? null;
}

export function filenameMatchesScope(
  filename: string,
  scope: BookScope
): boolean {
  if (!scope || scope === "auto") return true;
  const book = LAW_BOOKS.find((b) => b.id === scope);
  if (!book) return true;
  if (book.exclude?.test(filename)) return false;
  return book.match.test(filename);
}

export function resolveBookTitleFromFilename(filename: string): string {
  for (const book of LAW_BOOKS) {
    if (book.exclude?.test(filename)) continue;
    if (book.match.test(filename)) return book.title;
  }

  return filename
    .replace(/\.txt$/i, "")
    .replace(/\.pdf$/i, "")
    .replace(/^lawComission\//, "")
    .replace(/^refined\//, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export function resolveBookIdFromFilename(filename: string): string | null {
  for (const book of LAW_BOOKS) {
    if (book.exclude?.test(filename)) continue;
    if (book.match.test(filename)) return book.id;
  }
  return null;
}

export function chunkMatchesBook(
  filename: string,
  scope: BookScope
): boolean {
  return filenameMatchesScope(filename, scope);
}

/** Drop chunks outside the user-selected book(s) (no-op when scope is auto). */
export function filterChunksToBookScope<T extends { filename: string }>(
  chunks: T[],
  bookScope: BookScope | string[]
): T[] {
  if (!bookScope || bookScope === "auto") return chunks;
  if (Array.isArray(bookScope)) {
    if (bookScope.length === 0) return chunks;
    return chunks.filter((c) =>
      bookScope.some((id) => filenameMatchesScope(c.filename, id))
    );
  }
  return chunks.filter((c) => filenameMatchesScope(c.filename, bookScope));
}

/** Map LLM / user act labels to indexed book scope id. */
/** Map UI book id → normalize-prompt act id (book lock only). */
export function bookScopeToNormalizeAct(
  scope: BookScope
): "devani" | "devani_karyavidhi" | "aparadh" | "faujdari_karyavidhi" | null {
  switch (scope) {
    case "civil-code":
      return "devani";
    case "civil-procedure":
      return "devani_karyavidhi";
    case "criminal-code":
      return "aparadh";
    case "criminal-procedure":
      return "faujdari_karyavidhi";
    default:
      return null;
  }
}

export function normalizeActToBookScope(act: string): BookScope | null {
  const a = act.trim().toLowerCase();
  if (LAW_BOOKS.some((b) => b.id === a)) return a;
  if (/civil.?procedure|देवानी.*कार्यविध|civil-procedure|karyavidhi/i.test(a)) {
    return "civil-procedure";
  }
  if (/criminal.?procedure|फौजदारी.*कार्यविध|criminal-procedure|faujdar/i.test(a)) {
    return "criminal-procedure";
  }
  if (/criminal.?code|अपराध.*संहित|criminal-code|aparadh/i.test(a)) {
    return "criminal-code";
  }
  if (/civil.?code|देवानी.*संहित|civil-code|devani.*sanhita/i.test(a)) {
    return "civil-code";
  }
  return null;
}

export function filterChunksByBook<T extends { filename: string }>(
  chunks: T[],
  scope: BookScope
): T[] {
  if (!scope || scope === "auto") return chunks;
  return chunks.filter((chunk) => filenameMatchesScope(chunk.filename, scope));
}
