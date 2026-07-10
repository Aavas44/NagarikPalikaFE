import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { embedTexts } from "../../src/lib/sajilokanun/ai";
import {
  extractPdfPages,
  splitPagesForIngest,
} from "../../src/lib/sajilokanun/pdf-extract";
import { buildChunkRows, insertChunkRows } from "../../src/lib/sajilokanun/chunk-insert";
import {
  cleanIngestChunks,
  getTextCleanProvider,
} from "../../src/lib/sajilokanun/chunk-clean";
import { titleFromFilename } from "../../src/lib/sajilokanun/legal-chunk";
import { getPilotPdfs, isPilotMode } from "../../src/lib/sajilokanun/pilot";
import { resolveIndexingRule } from "../../src/lib/sajilokanun/indexing-rules";
import { ingestWithRule } from "../../src/lib/sajilokanun/ingest-indexed";
import { getSupabaseAdmin } from "../../src/lib/sajilokanun/supabase";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1500;
const REINGEST = process.argv.includes("--reingest");

function getFileArg(): string | null {
  const idx = process.argv.indexOf("--file");
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

function resolveIngestFiles(): string[] {
  const single = getFileArg();
  if (single) {
    const filePath = path.join(LAWFILES_DIR, single);
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF not found: ${filePath}`);
    }
    return [single];
  }

  if (isPilotMode()) {
    const pilotFiles = getPilotPdfs().filter((file) => {
      const filePath = path.join(LAWFILES_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`  Skipping missing pilot PDF: ${file}`);
        return false;
      }
      return true;
    });
    if (pilotFiles.length > 0) return pilotFiles;
  }

  const allFiles = fs
    .readdirSync(LAWFILES_DIR)
    .filter((file) => file.toLowerCase().endsWith(".pdf"));
  return allFiles;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parsePdf(filePath: string) {
  return extractPdfPages(filePath);
}

async function ingestFile(filename: string) {
  const rule = resolveIndexingRule(filename);
  if (rule) {
    console.log(`\nProcessing: ${filename} (rule: ${rule.id})`);
    await ingestWithRule(rule, { reingest: REINGEST });
    return;
  }

  const supabase = getSupabaseAdmin();
  const filePath = path.join(LAWFILES_DIR, filename);
  const title = titleFromFilename(filename);

  console.log(`\nProcessing: ${filename}`);

  const { data: existingDoc } = await supabase
    .from("documents")
    .select("id")
    .eq("filename", filename)
    .maybeSingle();

  const { count: existingChunkCount } = existingDoc
    ? await supabase
        .from("chunks")
        .select("*", { count: "exact", head: true })
        .eq("document_id", existingDoc.id)
    : { count: 0 };

  const pages = await extractPdfPages(filePath);
  if (pages.length === 0) {
    console.warn(`  WARNING: No text extracted. PDF may be scanned/image-only.`);
    return;
  }

  const useLegal =
    pages.length > 0 &&
    /देवानी.*संहिता|संहिता.*देवानी|अपराध.*संहिता|कार्यविधि|karyavidhi|faujdar|फौजदारी/i.test(
      filename
    );
  const rawChunks = splitPagesForIngest(pages, filename);
  console.log(
    `  Extracted ${rawChunks.length} ${useLegal ? "section" : ""} chunks across ${pages.length} pages`
  );

  const cleanProvider = getTextCleanProvider();
  if (cleanProvider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when TEXT_CLEAN_PROVIDER=gemini");
  }

  let chunks = rawChunks;
  console.log(`  Text cleanup (${cleanProvider})...`);
  const { chunks: cleaned, summary } = await cleanIngestChunks(
    rawChunks,
    filename,
    {
      provider: cleanProvider,
      onProgress: (done, total) => {
        if (cleanProvider === "gemini" && (done % 50 === 0 || done === total)) {
          console.log(`  Cleaned ${done}/${total}`);
        }
      },
    }
  );
  chunks = cleaned;
  if (cleanProvider === "gemini") {
    console.log(
      `  Cleanup: ${summary.totalWordChanges} word changes, ${summary.rejectedCount} rejected`
    );
    console.log(`  Change log: ${summary.logDir}/summary.md`);
  } else if (summary.cleanedCount > 0) {
    console.log(`  Regex cleanup: ${summary.cleanedCount} chunks adjusted`);
  }

  if (
    existingDoc &&
    !REINGEST &&
    (existingChunkCount ?? 0) >= chunks.length
  ) {
    console.log(`  Skipping (already ingested). Use --reingest to replace.`);
    return;
  }

  let documentId = existingDoc?.id;

  if (existingDoc && REINGEST) {
    await supabase.from("chunks").delete().eq("document_id", existingDoc.id);
    await supabase.from("documents").delete().eq("id", existingDoc.id);
    documentId = undefined;
  }

  if (!documentId) {
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({ filename, title })
      .select("id")
      .single();

    if (docError || !document) {
      throw new Error(`Failed to insert document: ${docError?.message}`);
    }

    documentId = document.id;
  }

  const startIndex = REINGEST ? 0 : (existingChunkCount ?? 0);
  if (startIndex > 0) {
    console.log(`  Resuming from chunk ${startIndex + 1}/${chunks.length}`);
  }

  for (let i = startIndex; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedTexts(batch.map((c) => c.content));

    const rows = buildChunkRows(
      documentId!,
      batch,
      i,
      true,
      embeddings
    );

    await insertChunkRows(rows);

    console.log(
      `  Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`
    );

    if (i + BATCH_SIZE < chunks.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`  Done: ${filename}`);
}

async function main() {
  const provider = process.env.LLM_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "gemini");
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in .env.local");
  }
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required in .env.local");
  }

  if (!fs.existsSync(LAWFILES_DIR)) {
    throw new Error(`Lawfiles directory not found: ${LAWFILES_DIR}`);
  }

  const files = resolveIngestFiles();

  if (files.length === 0) {
    throw new Error("No matching PDF files found for ingestion.");
  }

  if (getFileArg()) {
    console.log(`Single-book ingest: ${files[0]}`);
  } else if (isPilotMode()) {
    console.log(`Pilot mode: ingesting ${files.length} PDF(s)`);
  } else {
    console.log(`Found ${files.length} PDF(s)`);
  }

  for (const file of files) {
    await ingestFile(file);
  }

  console.log("\nIngestion complete.");
  console.log(
    "Tip: After first ingest, run the IVFFlat index SQL in supabase/schema.sql for faster search."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
