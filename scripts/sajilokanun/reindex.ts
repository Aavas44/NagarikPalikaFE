/**
 * Re-index books using indexing rules (nepali-law parser + .txt sources).
 *
 * Usage:
 *   npx tsx scripts/reindex.ts --rule civil-code --reingest
 *   npx tsx scripts/reindex.ts --all-lawcomission --reingest
 */
import { config } from "dotenv";
import {
  getIndexingRuleById,
  LAWCOMISSION_INDEXING_RULES,
} from "../../src/lib/sajilokanun/indexing-rules";
import { ingestAllLawComission, ingestWithRule, normalizeLawComissionStructure } from "../../src/lib/sajilokanun/ingest-indexed";

config({ path: ".env.local" });

function getRuleArg(): string | null {
  const idx = process.argv.indexOf("--rule");
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return process.argv[idx + 1];
}

async function main() {
  const reingest = process.argv.includes("--reingest");
  const allLawComission = process.argv.includes("--all-lawcomission");
  const skipNormalize = process.argv.includes("--skip-normalize");

  if (allLawComission) {
    if (!skipNormalize) {
      console.log("Normalizing lawComission structure…");
      normalizeLawComissionStructure();
    }
    console.log(
      `Re-indexing ${LAWCOMISSION_INDEXING_RULES.length} lawComission books…`
    );
    await ingestAllLawComission({ reingest });
    console.log("\nAll lawComission reindex complete.");
    return;
  }

  const ruleId = getRuleArg();
  if (!ruleId) {
    throw new Error(
      "Usage: npx tsx scripts/reindex.ts --rule <rule-id> [--reingest] [--skip-normalize]\n" +
        "       npx tsx scripts/reindex.ts --all-lawcomission [--reingest] [--skip-normalize]"
    );
  }

  const rule = getIndexingRuleById(ruleId);
  if (!rule) {
    throw new Error(`Unknown indexing rule: ${ruleId}`);
  }

  if (!skipNormalize && rule.sourceText.startsWith("lawComission/")) {
    console.log(`Normalizing structure for ${ruleId}…`);
    normalizeLawComissionStructure(ruleId);
  }

  await ingestWithRule(rule, { reingest });
  console.log("\nReindex complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
