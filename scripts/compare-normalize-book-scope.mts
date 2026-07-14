/**
 * Compare normalize for polygamy query: civil-code only vs all 4 books.
 * Usage: cd frontend && QUERY_NORMALIZE_SLIM=false npx tsx scripts/compare-normalize-book-scope.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.QUERY_NORMALIZE_SLIM = process.env.QUERY_NORMALIZE_SLIM ?? "false";

import { normalizeQueryWithGemini } from "../src/lib/sajilokanun/query-translate.ts";
import { buildNormalizeSystemInstruction } from "../src/lib/sajilokanun/query-normalize-prompt.ts";
import { formatDafaTaxonomyForPrompt } from "../src/lib/sajilokanun/dafa-name-taxonomy.ts";

const QUERY = "bahubiwah garna huncha ki hudaina";

async function run(label: string, book?: string) {
  const systemChars = buildNormalizeSystemInstruction(
    book === "civil-code" ? "devani" : null,
    book === "civil-code" ? "civil-code" : "auto"
  ).length;
  const taxonomyChars = formatDafaTaxonomyForPrompt(
    book === "civil-code" ? "civil-code" : "auto"
  ).length;

  const result = await normalizeQueryWithGemini(QUERY, {
    book: book as "civil-code" | undefined,
  });

  console.log(`\n=== ${label} ===`);
  console.log("taxonomyChars:", taxonomyChars);
  console.log("systemChars:", systemChars);
  console.log(JSON.stringify(result.metadataHint, null, 2));
  console.log("queryUsed:", result.queryUsed);
  console.log("searchKeywords:", result.searchKeywords);
}

async function main() {
  await run("civil-code only (Muluki Devani Samhita)", "civil-code");
  await run("auto (all 4 books)", undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
