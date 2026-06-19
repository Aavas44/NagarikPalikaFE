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
