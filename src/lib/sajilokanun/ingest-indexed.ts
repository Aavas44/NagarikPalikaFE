import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { embedTexts } from "./ai";
import { buildChunkRows, insertChunkRows } from "./chunk-insert";
import type { IngestChunk } from "./pdf-extract";
import type { IndexingRule } from "./indexing-rules";
import { nepaliLawChunksToIngest } from "./nepali-law-chunk-map";
import { parseNepaliLawText } from "./nepali-law-parser";
import { getSupabaseAdmin } from "./supabase";

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

export function getStructuredSourcePath(rule: IndexingRule): string {
  if (!rule.sourceText.startsWith("lawComission/")) {
    return rule.sourceText;
  }
  return rule.sourceText.replace("lawComission/", "lawComission/.structured/");
}

export function readRuleSourceText(rule: IndexingRule): {
  text: string;
  inputFormat: "markers" | "indented";
  sourcePath: string;
} {
  const structuredRel = getStructuredSourcePath(rule);
  const structuredPath = path.join(LAWFILES_DIR, structuredRel);
  if (fs.existsSync(structuredPath)) {
    return {
      text: fs.readFileSync(structuredPath, "utf-8"),
      inputFormat: "indented",
      sourcePath: structuredRel,
    };
  }

  const filePath = path.join(LAWFILES_DIR, rule.sourceText);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Source text not found: ${filePath}`);
  }
  return {
    text: fs.readFileSync(filePath, "utf-8"),
    inputFormat: "markers",
    sourcePath: rule.sourceText,
  };
}

export async function deleteDocumentsForRule(rule: IndexingRule): Promise<void> {
  const supabase = getSupabaseAdmin();
  for (const filename of rule.replaceDocumentFilenames) {
    const { data: doc } = await supabase
      .from("documents")
      .select("id")
      .eq("filename", filename)
      .maybeSingle();
    if (!doc) continue;
    await supabase.from("chunks").delete().eq("document_id", doc.id);
    const { error: docDelError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    if (docDelError) {
      throw new Error(`Failed to delete document ${filename}: ${docDelError.message}`);
    }
    console.log(`  Removed old document: ${filename}`);
  }
}

export async function buildChunksForRule(rule: IndexingRule): Promise<IngestChunk[]> {
  const { text: rawText, inputFormat, sourcePath } = readRuleSourceText(rule);
  if (!rawText.trim()) {
    throw new Error(`Empty source text: ${sourcePath}`);
  }

  if (
    rule.chunking.strategy !== "nepali-law" &&
    rule.chunking.strategy !== "structured-legal"
  ) {
    throw new Error(`Unsupported chunking strategy: ${rule.chunking.strategy}`);
  }

  const pythonChunks = parseNepaliLawText(rawText, rule, { inputFormat });
  const rawChunks = nepaliLawChunksToIngest(pythonChunks, rule);

  if (rawChunks.length === 0) {
    throw new Error(`Parser produced 0 chunks from ${sourcePath}`);
  }

  console.log(
    `  Nepali-law chunks: ${rawChunks.length} (${inputFormat} from ${sourcePath})`
  );
  return rawChunks;
}

/** Generate Lawfiles/lawComission/.structured/*.txt from canonical sources. */
export function normalizeLawComissionStructure(bookId?: string): void {
  const script = path.join(process.cwd(), "scripts/normalize_law_structure.py");
  const args = [script, "--write", bookId ? "--book" : "--all"];
  if (bookId) args.push(bookId);

  const result = spawnSync("python3", args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Structure normalizer failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Structure normalizer exited ${result.status}: ${result.stderr || result.stdout}`
    );
  }
  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

export async function ingestWithRule(
  rule: IndexingRule,
  options: { reingest?: boolean } = {}
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ingestFilename = rule.ingestFilename;

  console.log(`\nIndexing rule: ${rule.id}`);
  console.log(`  Source text: ${rule.sourceText}`);
  console.log(`  Document: ${rule.documentTitle}`);

  if (options.reingest) {
    await deleteDocumentsForRule(rule);
  }

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("filename", ingestFilename)
    .maybeSingle();

  if (existingDoc && !options.reingest) {
    const { count } = await supabase
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", existingDoc.id);
    if ((count ?? 0) > 0) {
      console.log(`  Skipping (already indexed). Use --reingest to replace.`);
      return;
    }
  }

  const chunks = await buildChunksForRule(rule);

  let documentId = existingDoc?.id;
  if (!documentId) {
    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        filename: ingestFilename,
        title: rule.documentTitle,
        document_category: rule.documentCategory,
        indexing_rule_id: rule.id,
      })
      .select("id")
      .single();

    if (error?.message?.includes("duplicate key")) {
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("filename", ingestFilename)
        .maybeSingle();
      if (!existing) {
        throw new Error(`Failed to insert document: ${error.message}`);
      }
      documentId = existing.id;
      if (options.reingest) {
        await supabase.from("chunks").delete().eq("document_id", documentId);
      }
    } else if (error || !document) {
      throw new Error(`Failed to insert document: ${error?.message}`);
    } else {
      documentId = document.id;
    }
  } else if (options.reingest) {
    await supabase
      .from("documents")
      .update({
        title: rule.documentTitle,
        document_category: rule.documentCategory,
        indexing_rule_id: rule.id,
      })
      .eq("id", documentId);
    await supabase.from("chunks").delete().eq("document_id", documentId);
  }

  const BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE ?? 3);
  const BATCH_DELAY_MS = Number(process.env.EMBED_BATCH_DELAY_MS ?? 2000);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTexts(
      batch.map((chunk) => chunk.embedText ?? chunk.content)
    );

    await insertChunkRows(
      buildChunkRows(documentId!, batch, i, true, embeddings)
    );

    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);

    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`  Done: ${rule.id} (${chunks.length} chunks)`);
}

export async function ingestAllLawComission(
  options: { reingest?: boolean; maxRetries?: number } = {}
): Promise<void> {
  const { LAWCOMISSION_INDEXING_RULES } = await import("./indexing-rules");
  const maxRetries = options.maxRetries ?? 3;
  const failed: string[] = [];

  for (const rule of LAWCOMISSION_INDEXING_RULES) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`  Retry ${attempt}/${maxRetries} for ${rule.id}…`);
        }
        await ingestWithRule(rule, options);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ${rule.id} attempt ${attempt} failed: ${msg}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 5000 * attempt));
        }
      }
    }
    if (lastError) {
      failed.push(rule.id);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `Reindex failed for: ${failed.join(", ")} (after ${maxRetries} attempts each)`
    );
  }
}
