/**
 * Verify retrieval for key दफा queries (no dev server needed).
 */
import { config } from "dotenv";
import { retrieveChunks } from "../../src/lib/sajilokanun/retrieve";

config({ path: ".env.local" });

const QUERIES = [
  "दफा १० के हो?",
  "दफा ११ को सजाय",
  "दफा १७",
  "dafa 17",
  "दफा २३९",
  "दफा २४४",
  "दफा २४५",
];

async function main() {
  for (const query of QUERIES) {
    console.log(`\n=== ${query} ===`);
    const { chunks, mode } = await retrieveChunks(query, 5);
    console.log(`Mode: ${mode}, hits: ${chunks.length}`);
    for (const chunk of chunks.slice(0, 3)) {
      const preview = chunk.content.replace(/\s+/g, " ").slice(0, 180);
      console.log(
        `  दफा ${chunk.section_label ?? "?"} | p.${chunk.page_number} | ${(chunk.similarity * 100).toFixed(0)}%`
      );
      console.log(`  ${preview}…`);
    }
    if (chunks.length === 0) {
      console.log("  WARNING: no results");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
