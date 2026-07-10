import { normalizeForEmbedding } from "./embedding-text";
import type { IngestChunk } from "./pdf-extract";
import type { IndexingRule, StructuredChunkMetadata } from "./indexing-rules";
import { toNepaliNumberDisplay } from "./nepali-digits";
import type { NepaliLawPythonChunk } from "./nepali-law-parser";

function buildDisplayContent(
  metadata: StructuredChunkMetadata,
  body: string,
  pageNumber: number
): string {
  const lines = [
    `पुस्तक : ${metadata.document_title}`,
    metadata.part && `भाग : ${metadata.part.replace(/^भाग\s*/, "")}`,
    metadata.chapter &&
      `परिच्छेद : ${metadata.chapter.replace(/^परिच्छेद\s*/, "")}`,
    metadata.section_title
      ? `दफा : ${metadata.section_dafa} — ${metadata.section_title}`
      : `दफा : ${metadata.section_dafa}`,
    metadata.subsection_upadafa &&
      `उपदफा : ${metadata.subsection_upadafa}`,
    metadata.clause_khanda && `खण्ड : ${metadata.clause_khanda}`,
    metadata.chunk_type && metadata.chunk_type !== "dafa" &&
      `प्रकार : ${metadata.chunk_type}`,
    formatReferenceLine(metadata.references),
    `पृष्ठ : ${toNepaliNumberDisplay(String(pageNumber))}`,
  ].filter(Boolean);

  return `${lines.join("\n")}\n\n${body.trim()}`;
}

function formatReferenceLine(refs: StructuredChunkMetadata["references"]): string | null {
  if (!refs?.length) return null;
  const parts = refs.map((r) => {
    const bits = [`दफा ${r.section_dafa}`];
    if (r.subsection_upadafa) bits.push(`उपदफा (${r.subsection_upadafa})`);
    if (r.clause_khanda) bits.push(`खण्ड (${r.clause_khanda})`);
    return bits.join(" ");
  });
  return `सन्दर्भ : ${parts.join("; ")}`;
}

function mapMetadata(
  rule: IndexingRule,
  chunk: NepaliLawPythonChunk
): StructuredChunkMetadata {
  const m = chunk.metadata;
  const references = m.references?.length ? m.references : undefined;
  return {
    chunk_id: chunk.chunk_id,
    document_title: rule.documentTitle,
    document_category: rule.documentCategory,
    part: m.bhag ?? null,
    chapter: m.parichhed ?? null,
    section_dafa: m.dafa ?? "",
    section_title: m.dafa_title ?? null,
    subsection_upadafa: m.upadafa ?? null,
    clause_khanda: m.khanda ?? null,
    chunk_type: m.chunk_type ?? null,
    references,
    chapter_hadamyad_dafa: m.chapter_hadamyad_dafa ?? null,
    provision_role: m.provision_role ?? null,
  };
}

export function nepaliLawChunksToIngest(
  pythonChunks: NepaliLawPythonChunk[],
  rule: IndexingRule
): IngestChunk[] {
  return pythonChunks.map((chunk) => {
    const metadata = mapMetadata(rule, chunk);
    const refLine = formatReferenceLine(metadata.references);
    const embedText = normalizeForEmbedding(
      refLine ? `${chunk.text} ${refLine}` : chunk.text
    );
    const body = chunk.text.replace(/^\[[^\]]+\]:\s*/, "").trim();

    return {
      content: buildDisplayContent(metadata, body, 1),
      pageNumber: 1,
      sectionLabel: chunk.metadata.dafa_arabic ?? null,
      chapter: metadata.chapter,
      sectionTitle: metadata.section_title,
      embedText,
      chunkId: chunk.chunk_id,
      part: metadata.part,
      subsectionLabel: metadata.subsection_upadafa,
      clauseLabel: metadata.clause_khanda,
      metadata,
    };
  });
}
