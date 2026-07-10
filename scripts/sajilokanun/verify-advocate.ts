/**
 * Verify AI Lawyer query analysis + multi-query retrieval (no dev server).
 *
 * Usage: npx tsx scripts/verify-advocate.ts
 */
import { config } from "dotenv";
import { analyzeQuery } from "../../src/lib/sajilokanun/query-analysis";
import {
  extractSectionFromQuery,
  retrieveChunks,
  retrieveChunksMulti,
} from "../../src/lib/sajilokanun/retrieve";

config({ path: ".env.local" });

const SCENARIO_QUERIES = [
  "प्रतिउत्तर कहिले दाखिल गर्नुपर्छ?",
  "When must a written reply be filed in a civil case?",
  "फौजदारी मुद्दामा अनुसन्धान कसले गर्छ?",
];

const QUOTE_QUERIES = ["दफा १० के हो?", "dafa 2"];

async function main() {
  console.log("=== AI Lawyer: scenario queries ===\n");

  for (const query of SCENARIO_QUERIES) {
    console.log(`\n--- Query: ${query} ---`);
    const analysis = await analyzeQuery(query, "auto");
    const { chunks, mode } = await retrieveChunksMulti(
      analysis.retrievalQueries,
      5,
      "auto",
      query,
      analysis.preferredAct
    );
    console.log(`Retrieval mode: ${mode}, hits: ${chunks.length}`);
    for (const chunk of chunks) {
      console.log(
        `  दफा ${chunk.section_label ?? "?"} | ${chunk.filename} | sim ${(chunk.similarity * 100).toFixed(0)}%`
      );
    }
  }

  console.log("\n\n=== Quote mode: दफा lookups (verbatim path) ===\n");

  for (const query of QUOTE_QUERIES) {
    const sectionNum = extractSectionFromQuery(query);
    const { chunks, mode } = await retrieveChunks(query, 5, "auto");
    console.log(`Query: ${query}`);
    console.log(`  Section extracted: ${sectionNum ?? "none"}`);
    console.log(`  Mode: ${mode}, hits: ${chunks.length}`);
    if (chunks[0]) {
      console.log(
        `  Top: दफा ${chunks[0].section_label} | ${chunks[0].filename}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
