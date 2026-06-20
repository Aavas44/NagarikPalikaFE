export interface GlossaryEntry {
  term: string;
  "Roman Transliteration": string;
  english: string | null;
  meaning: string;
}

export interface GlossaryFile {
  source: string;
  pages: string;
  count: number;
  entries: GlossaryEntry[];
}

export interface GlossarySearchResult {
  term: string;
  romanTransliteration: string;
  english: string | null;
  meaning: string;
  meaningNe?: string | null;
  meaningEn?: string | null;
  source?: "saralsewa" | "kanuni";
  score: number;
}

export interface GlossarySearchResponse {
  query: string;
  total: number;
  results: GlossarySearchResult[];
}

export interface GlossaryBrowseResponse {
  mode: "browse";
  letter: string | null;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  results: GlossarySearchResult[];
  indexCounts: Record<string, number>;
}
