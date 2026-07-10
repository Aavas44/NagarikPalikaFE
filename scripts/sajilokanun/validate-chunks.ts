/**
 * Validate legal chunking for a PDF without API calls.
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { extractPdfPages, splitPagesForIngest } from "../../src/lib/sajilokanun/pdf-extract";

config({ path: ".env.local" });

const LAWFILES_DIR = path.join(process.cwd(), "Lawfiles");
const TARGET =
  process.argv[2] ?? "मुलुकी_देवानी_(संहिता) ऐन,२०७४.pdf";

const SPOT_CHECKS = ["10", "11", "239"];

async function main() {
  const filePath = path.join(LAWFILES_DIR, TARGET);
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF not found: ${filePath}`);
  }

  console.log(`Validating: ${TARGET}\n`);

  const pages = await extractPdfPages(filePath);
  const chunks = splitPagesForIngest(pages, TARGET);

  const labeled = chunks.filter((c) => c.sectionLabel);
  const unlabeled = chunks.filter((c) => !c.sectionLabel);
  const withSubsection = chunks.filter((c) =>
    c.sectionLabel?.includes(".")
  );
  const uniqueSections = new Set(
    chunks
      .map((c) => c.sectionLabel?.split(".")[0])
      .filter(Boolean)
  );

  const subsectionMentions = chunks.reduce((count, chunk) => {
    const matches = chunk.content.match(/उपदफा|\(\d+\)|\([०-९]+\)/g);
    return count + (matches?.length ?? 0);
  }, 0);

  console.log("Summary");
  console.log("-------");
  console.log(`Pages extracted:     ${pages.length}`);
  console.log(`Total chunks:        ${chunks.length}`);
  console.log(`Labeled chunks:      ${labeled.length}`);
  console.log(`Unlabeled chunks:    ${unlabeled.length}`);
  console.log(`Unique दफा:          ${uniqueSections.size}`);
  console.log(`Subsection chunks:   ${withSubsection.length}`);
  console.log(`उपदफा mentions:      ${subsectionMentions}`);

  if (unlabeled.length > 0) {
    console.log("\nUnlabeled chunk pages:");
    for (const chunk of unlabeled.slice(0, 5)) {
      console.log(`  p.${chunk.pageNumber} (${chunk.content.length} chars)`);
    }
  }

  console.log("\nSpot checks");
  console.log("-----------");
  for (const section of SPOT_CHECKS) {
    const matches = chunks.filter(
      (c) => c.sectionLabel === section || c.sectionLabel?.startsWith(`${section}.`)
    );
    console.log(`\nदफा ${section}: ${matches.length} chunk(s)`);
    for (const chunk of matches.slice(0, 3)) {
      const preview = chunk.content.replace(/\s+/g, " ").slice(0, 200);
      console.log(`  p.${chunk.pageNumber} [${chunk.sectionLabel}] ${preview}…`);
    }
    if (matches.length === 0) {
      console.log("  WARNING: no chunks found");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
