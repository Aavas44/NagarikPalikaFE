import type { IngestChunk } from "./pdf-extract";
import { getSupabaseAdmin } from "./supabase";

export type ChunkInsertRow = {
  document_id: string;
  content: string;
  page_number: number;
  chunk_index: number;
  embedding?: number[] | null;
  section_label?: string | null;
  chapter?: string | null;
  section_title?: string | null;
  chunk_id?: string | null;
  part?: string | null;
  subsection_label?: string | null;
  clause_label?: string | null;
  metadata?: Record<string, unknown> | null;
};

let sectionColumnsAvailable: boolean | null = null;
let metadataColumnsAvailable: boolean | null = null;
let sectionColumnsWarned = false;

export async function hasSectionColumns(): Promise<boolean> {
  if (sectionColumnsAvailable !== null) return sectionColumnsAvailable;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("chunks")
    .select("section_label")
    .limit(0);

  sectionColumnsAvailable = !(
    error?.message.includes("section_label") ||
    error?.message.includes("chapter")
  );
  return sectionColumnsAvailable;
}

export async function hasMetadataColumns(): Promise<boolean> {
  if (metadataColumnsAvailable !== null) return metadataColumnsAvailable;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("chunks")
    .select("chunk_id, metadata")
    .limit(0);

  metadataColumnsAvailable = !(
    error?.message.includes("chunk_id") ||
    error?.message.includes("metadata")
  );
  return metadataColumnsAvailable;
}

export function buildChunkRows(
  documentId: string,
  chunks: IngestChunk[],
  startIndex: number,
  includeSections: boolean,
  embeddings?: number[][]
): ChunkInsertRow[] {
  return chunks.map((chunk, index) => {
    const row: ChunkInsertRow = {
      document_id: documentId,
      content: chunk.content,
      page_number: chunk.pageNumber,
      chunk_index: startIndex + index,
      embedding: embeddings ? embeddings[index] : null,
    };

    if (includeSections) {
      row.section_label = chunk.sectionLabel;
      row.chapter = chunk.chapter;
      row.section_title = chunk.sectionTitle;
      row.chunk_id = chunk.chunkId ?? null;
      row.part = chunk.part ?? null;
      row.subsection_label = chunk.subsectionLabel ?? null;
      row.clause_label = chunk.clauseLabel ?? null;
      row.metadata = chunk.metadata ?? null;
    }

    return row;
  });
}

export async function insertChunkRows(rows: ChunkInsertRow[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const includeSections = await hasSectionColumns();
  const includeMetadata = await hasMetadataColumns();

  let payload = rows.map((row) => {
    const copy = { ...row };
    if (!includeSections) {
      delete copy.section_label;
      delete copy.chapter;
      delete copy.section_title;
    }
    if (!includeMetadata) {
      delete copy.chunk_id;
      delete copy.part;
      delete copy.subsection_label;
      delete copy.clause_label;
      delete copy.metadata;
    }
    return copy;
  });

  if (!includeSections) {
    payload = payload.map(
      ({ section_label, chapter, section_title, ...rest }) => rest
    );
  }

  if (!includeSections && rows.some((r) => r.section_label) && !sectionColumnsWarned) {
    sectionColumnsWarned = true;
    console.warn(
      "  Section columns missing — run supabase/migration-sections.sql"
    );
  }

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.from("chunks").insert(payload);
    if (!error) return;

    const retryable =
      /fetch failed|timeout|ECONNRESET|ETIMEDOUT|502|503|504/i.test(
        error.message
      );
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }

    const waitMs = Math.min(2000 * 2 ** (attempt - 1), 30000);
    console.warn(
      `  Chunk insert retry in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${maxAttempts})`
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
