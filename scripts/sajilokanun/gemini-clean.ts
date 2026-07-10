/**
 * Gemini word-level cleanup — dry run with change log (no DB / no embeddings).
 *
 * Review logs/gemini-cleanup/<runId>/summary.md before ingesting.
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { cleanIngestChunks } from "../../src/lib/sajilokanun/chunk-clean";
import { extractPdfPages, splitPagesForIngest } from "../../src/lib/sajilokanun/pdf-extract";
import { getPilotPdfs, isPilotMode } from "../../src/lib/sajilokanun/pilot";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required in .env.local");
  }

  const allFiles = fs
    .readdirSync(LAWFILES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  const files = isPilotMode()
    ? allFiles.filter((f) => getPilotPdfs().includes(f))
    : allFiles;

  if (files.length === 0) {
    throw new Error("No PDF files found.");
  }

  for (const filename of files) {
    console.log(`\nGemini cleanup (dry run): ${filename}`);

    const pages = await extractPdfPages(path.join(LAWFILES_DIR, filename));
    const rawChunks = splitPagesForIngest(pages, filename);
    console.log(`  ${rawChunks.length} chunks`);

    const { summary } = await cleanIngestChunks(rawChunks, filename, {
      provider: "gemini",
      onProgress: (done, total) => {
        if (done % 25 === 0 || done === total) {
          console.log(`  Cleaned ${done}/${total}`);
        }
      },
    });

    console.log(`\n  Summary:`);
    console.log(`    Word changes: ${summary.totalWordChanges}`);
    console.log(`    Chunks cleaned: ${summary.cleanedCount}`);
    console.log(`    Unchanged: ${summary.unchangedCount}`);
    console.log(`    Rejected: ${summary.rejectedCount}`);
    console.log(`\n  Review: ${summary.logDir}/summary.md`);
    console.log(`          ${summary.logDir}/changes.jsonl`);
  }

  console.log(
    "\nDry run complete. If changes look good, run:\n  TEXT_CLEAN_PROVIDER=gemini npm run ingest -- --reingest"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
