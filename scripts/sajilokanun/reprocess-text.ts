/**
 * Re-extract and re-chunk PDFs with improved text cleaning.
 * No API calls — safe when Gemini quota is exhausted (keyword retrieval mode).
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { splitPagesForIngest, extractPdfPages } from "../../src/lib/sajilokanun/pdf-extract";
import { buildChunkRows, insertChunkRows } from "../../src/lib/sajilokanun/chunk-insert";
import { titleFromFilename } from "../../src/lib/sajilokanun/legal-chunk";
import { getPilotPdfs, isPilotMode } from "../../src/lib/sajilokanun/pilot";
import { getSupabaseAdmin } from "../../src/lib/sajilokanun/supabase";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

async function reprocessFile(filename: string) {
  const supabase = getSupabaseAdmin();
  const filePath = path.join(LAWFILES_DIR, filename);
  const title = titleFromFilename(filename);

  console.log(`\nReprocessing: ${filename}`);

  const pages = await extractPdfPages(filePath);
  if (pages.length === 0) {
    console.warn("  No text extracted.");
    return;
  }

  const chunks = splitPagesForIngest(pages, filename);
  console.log(`  ${chunks.length} chunks across ${pages.length} pages`);

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("filename", filename)
    .maybeSingle();

  if (existingDoc) {
    await supabase.from("chunks").delete().eq("document_id", existingDoc.id);
    await supabase.from("documents").delete().eq("id", existingDoc.id);
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({ filename, title })
    .select("id")
    .single();

  if (docError || !document) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  const rows = buildChunkRows(document.id, chunks, 0, true);

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await insertChunkRows(batch);
    console.log(`  Inserted ${Math.min(i + 50, rows.length)}/${rows.length}`);
  }

  console.log(`  Done: ${filename}`);
}

async function main() {
  const allFiles = fs
    .readdirSync(LAWFILES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  const files = isPilotMode()
    ? allFiles.filter((f) => getPilotPdfs().includes(f))
    : allFiles;

  console.log(`Reprocessing ${files.length} PDF(s) (no embedding API calls)`);

  for (const file of files) {
    await reprocessFile(file);
  }

  console.log("\nReprocess complete. Restart dev server and try your question again.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
