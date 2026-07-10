export type ChunkingStrategy = "nepali-law" | "structured-legal" | "legacy-legal" | "token";

export type IndexingChunkingConfig = {
  strategy: ChunkingStrategy;
  /** Max chars per chunk before splitting by उपदफा / खण्ड */
  maxSectionChars: number;
  splitBySubsection: boolean;
  splitByClause: boolean;
  stripPageNoise: boolean;
};

export type IndexingRule = {
  id: string;
  /** Match ingest path or filename */
  match: RegExp[];
  /** Primary text source relative to Lawfiles/ (used for indexing) */
  sourceText: string;
  /** Filename stored in documents table after ingest */
  ingestFilename: string;
  /** Remove these document rows on --reingest / reindex */
  replaceDocumentFilenames: string[];
  documentTitle: string;
  documentCategory: string;
  bookId: string;
  chunking: IndexingChunkingConfig;
};

export type LegalCrossReference = {
  section_dafa: string;
  subsection_upadafa?: string | null;
  clause_khanda?: string | null;
  raw?: string;
};

export type StructuredChunkMetadata = {
  chunk_id: string;
  document_title: string;
  document_category: string;
  part: string | null;
  chapter: string | null;
  section_dafa: string;
  section_title: string | null;
  subsection_upadafa: string | null;
  clause_khanda: string | null;
  chunk_type?: string | null;
  /** Inline दफा / उपदफा / खण्ड refs parsed from chunk body */
  references?: LegalCrossReference[];
  /** Same परिच्छेद's हदम्याद दफा (Devanagari), when one exists */
  chapter_hadamyad_dafa?: string | null;
  /** Set on the परिच्छेद–level हदम्याद दफा chunk */
  provision_role?: "hadamyad" | null;
};

export type StructuredIngestChunk = {
  chunkId: string;
  text: string;
  content: string;
  embedText: string;
  metadata: StructuredChunkMetadata;
  pageNumber: number;
  sectionLabel: string;
  chapter: string | null;
  sectionTitle: string | null;
  subsectionLabel: string | null;
  clauseLabel: string | null;
  part: string | null;
};
