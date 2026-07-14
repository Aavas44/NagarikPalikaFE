/**
 * Assert local taxonomy reconciliation (no LLM).
 *
 * Usage:
 *   npx tsx scripts/assert-reconcile.mts
 */
import { reconcileMatchingDafaNames, reconcileMetadataHint } from "../src/lib/sajilokanun/dafa-taxonomy-reconcile";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function run(): void {
  // LLM typo: बहुविवाह vs indexed वहुविवाह
  const polygamy = reconcileMatchingDafaNames(
    ["१७५. बहुविवाह गर्न नहुनेः", "४०. सजायका प्रकारः"],
    "Muluki Aparadh Samhita 2074"
  );

  assert(polygamy.items[0]?.matched === true, "polygamy दफा 175 should reconcile");
  assert(
    polygamy.matchingDafaNames[0]?.includes("वहुविवाह"),
    `expected वहुविवाह in reconciled line, got: ${polygamy.matchingDafaNames[0]}`
  );
  assert(polygamy.exactDafaGuess.includes(175), "exactDafaGuess should include 175");
  assert(polygamy.exactDafaGuess.includes(40), "exactDafaGuess should include 40");

  // Number anchor with partial title
  const partial = reconcileMatchingDafaNames(
    ["१७५. बहुविवाह"],
    "Muluki Aparadh Samhita 2074"
  );
  assert(partial.items[0]?.matched === true, "partial title with correct number should reconcile");
  assert(partial.exactDafaGuess.includes(175), "partial should resolve to दफा 175");

  // Wrong act scope: title should still find criminal polygamy दफा via fallback
  const crossAct = reconcileMatchingDafaNames(
    ["१७५. वहुविवाह गर्न नहुने"],
    "Muluki Devani Samhita 2074"
  );
  assert(
    crossAct.items[0]?.matched === true,
    "strong title match should reconcile even when act is wrong"
  );
  assert(
    crossAct.matchingDafaNames[0]?.includes("वहुविवाह"),
    `cross-act should find criminal polygamy, got: ${crossAct.matchingDafaNames[0]}`
  );

  // v19 format: "दफा १७५. बहुविवाह..."
  const cotFormat = reconcileMatchingDafaNames(
    ["दफा १७५. बहुविवाह गर्न नहुनेः", "दफा ४०. सजायका प्रकारः"],
    "Muluki Aparadh Samhita 2074"
  );
  assert(cotFormat.items[0]?.matched === true, "दफा-prefixed line should reconcile");
  assert(cotFormat.exactDafaGuess.includes(175), "cot format should resolve दफा 175");

  // Wrong act from LLM: title match should find criminal polygamy and infer Aparadh act
  const crossActInfer = reconcileMatchingDafaNames(
    ["१७५. बहुविवाह गर्न नहुने ः"],
    "Muluki Devani Samhita 2074"
  );
  assert(crossActInfer.items[0]?.actId === "aparadh", "should match criminal-code act");
  assert(
    crossActInfer.inferredAct === "Muluki Aparadh Samhita 2074",
    `inferred act should be Aparadh, got: ${crossActInfer.inferredAct}`
  );

  // Book lock: stay within civil-code taxonomy only
  const civilLocked = reconcileMatchingDafaNames(
    ["१७५. बहुविवाह गर्न नहुने ः", "७१. विवाह गर्न, गराउन नहुनेः"],
    "Muluki Devani Samhita 2074",
    "civil-code"
  );
  assert(
    civilLocked.inferredAct === "Muluki Devani Samhita 2074",
    `book lock should keep Devani act, got: ${civilLocked.inferredAct}`
  );
  assert(
    !civilLocked.matchingDafaNames[0]?.includes("वहुविवाह") &&
      !civilLocked.matchingDafaNames[0]?.includes("बहुविवाह"),
    "book lock should not pull criminal polygamy दफा"
  );

  // Metadata hint validation: wrong act + polygamy titles → Aparadh + 175
  const fromReconcileMeta = reconcileMetadataHint(
    {
      act: "Muluki Devani Samhita 2074",
      matchingDafaNames: [
        "१७५. बहुविवाह गर्न नहुने ः",
        "१७१. मञ्जुरी विना विवाह गर्न नहुने ः",
      ],
      exactDafaGuess: [175, 171],
    },
    "auto"
  );
  assert(
    fromReconcileMeta.act === "Muluki Aparadh Samhita 2074",
    `meta reconcile should correct act to Aparadh, got: ${fromReconcileMeta.act}`
  );
  assert(
    fromReconcileMeta.exactDafaGuess?.includes(175) === true,
    "meta reconcile should keep दफा 175"
  );

  console.log("assert-reconcile: all passed");
  console.log(
    JSON.stringify(
      { polygamy, partial, crossAct, crossActInfer, civilLocked, fromReconcileMeta },
      null,
      2
    )
  );
}

run();
