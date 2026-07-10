/**
 * Find likely broken words in chunks (Latin mixed in, mid-word spaces, known typos).
 */
import { config } from "dotenv";
import { extractPdfPages, splitPagesForIngest } from "../../src/lib/sajilokanun/pdf-extract";
import path from "path";

config({ path: ".env.local" });

const PDF =
  process.argv[2] ?? "मुलुकी_देवानी_(संहिता) ऐन,२०७४.pdf";

const ISSUE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "latin-in-devanagari", re: /[\u0900-\u097F][a-zA-Z]|[a-zA-Z][\u0900-\u097F]/ },
  { name: "mid-word-space", re: /[\u0900-\u097F]{2,}\s+[\u0900-\u097F]{1,2}(?=[\s\u0964])/ },
  { name: "civil-garbage", re: /।नयख।लउ/ },
  { name: "known-typo", re: /कानू\s+न|जााच|आकृित|उपदफm|फ्राथ|तापिन|व्यत्ति|संहतिा/ },
];

async function main() {
  const filePath = path.join(process.cwd(), "Lawfiles", PDF);
  const pages = await extractPdfPages(filePath);
  const chunks = splitPagesForIngest(pages, PDF);

  console.log(`Auditing ${chunks.length} chunks from ${PDF}\n`);

  for (const { name, re } of ISSUE_PATTERNS) {
    const hits: string[] = [];
    for (const chunk of chunks) {
      const body = chunk.content.split("\n").slice(1).join(" ") || chunk.content;
      if (re.test(body)) {
        const match = body.match(re)?.[0] ?? "?";
        hits.push(
          `  दफा ${chunk.sectionLabel ?? "?"} p.${chunk.pageNumber}: …${match}…`
        );
      }
    }
    console.log(`${name}: ${hits.length} chunk(s)`);
    hits.slice(0, 8).forEach((h) => console.log(h));
    if (hits.length > 8) console.log(`  … and ${hits.length - 8} more`);
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
