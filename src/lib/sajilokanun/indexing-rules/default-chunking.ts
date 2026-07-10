import type { IndexingChunkingConfig } from "./types";

/** Default chunking for all Muluki-style legal books (Python nepali-law parser). */
export const DEFAULT_NEPALI_LAW_CHUNKING: IndexingChunkingConfig = {
  strategy: "nepali-law",
  maxSectionChars: 1400,
  splitBySubsection: true,
  splitByClause: true,
  stripPageNoise: true,
};
