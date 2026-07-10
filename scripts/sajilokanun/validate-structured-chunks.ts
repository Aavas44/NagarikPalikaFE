/**
 * Validate structured chunks for an indexing rule (no DB / no embeddings).
 *
 * Usage: npx tsx scripts/validate-structured-chunks.ts --rule criminal-procedure
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { getIndexingRuleById } from "../../src/lib/sajilokanun/indexing-rules";
import { buildChunksForRule } from "../../src/lib/sajilokanun/ingest-indexed";
import { nepaliLawChunksToIngest } from "../../src/lib/sajilokanun/nepali-law-chunk-map";
import { parseNepaliLawText } from "../../src/lib/sajilokanun/nepali-law-parser";
import type { IngestChunk } from "../../src/lib/sajilokanun/pdf-extract";
import type { IndexingRule } from "../../src/lib/sajilokanun/indexing-rules";

config({ path: ".env.local" });

type PinResult = { name: string; ok: boolean; detail: string };

function chunkBody(chunk: IngestChunk): string {
  const arrow = chunk.content.lastIndexOf("->");
  if (arrow >= 0) return chunk.content.slice(arrow + 2).trim();
  const lines = chunk.content.split("\n");
  return lines[lines.length - 1]?.trim() ?? chunk.content;
}

function filterSectionUpadafa(chunks: IngestChunk[], sectionArabic: string): IngestChunk[] {
  return chunks.filter(
    (c) =>
      c.sectionLabel === sectionArabic &&
      c.metadata?.chunk_type === "upadafa"
  );
}

function validateDafa14(chunks: IngestChunk[]): PinResult[] {
  const results: PinResult[] = [];
  const upadafa = filterSectionUpadafa(chunks, "14");
  const bodies = upadafa.map(chunkBody);

  results.push({
    name: "दफा १४ उपदफा count",
    ok: upadafa.length >= 10,
    detail: `found ${upadafa.length} upadafa chunks (expected >= 10)`,
  });

  const stubOnly = bodies.filter((b) => /^उपदफा\s*$/u.test(b.trim()) || /^उपदफा\s*$/u.test(b));
  results.push({
    name: "दफा १४ no stub-only उपदफा",
    ok: stubOnly.length === 0,
    detail: stubOnly.length ? `stubs: ${stubOnly.length}` : "none",
  });

  const short = bodies.filter((b) => b.length < 80);
  results.push({
    name: "दफा १४ substantive body length",
    ok: short.length <= 1,
    detail: short.length ? `${short.length} bodies < 80 chars` : "all substantive",
  });

  const combined = bodies.join("\n");
  for (const needle of ["पन्ध्र दिन", "पच्चीस दिन", "चौबीस घण्टा"]) {
    results.push({
      name: `दफा १४ contains ${needle}`,
      ok: combined.includes(needle),
      detail: combined.includes(needle) ? "found" : "missing",
    });
  }

  return results;
}

function validateDafa517(chunks: IngestChunk[]): PinResult[] {
  const results: PinResult[] = [];
  const khanda = chunks.filter(
    (c) =>
      c.sectionLabel === "517" &&
      c.metadata?.chunk_type === "khanda" &&
      c.metadata?.clause_khanda
  );

  const upadafa4Khanda = khanda.filter((c) => c.metadata?.subsection_upadafa === "४");
  results.push({
    name: "दफा ५१७ void-list खण्ड not under उपदफा (४)",
    ok: upadafa4Khanda.length === 0,
    detail:
      upadafa4Khanda.length === 0
        ? "no खण्ड under उपदफा ४"
        : `${upadafa4Khanda.length} खण्ड wrongly under ४`,
  });

  const voidListKhanda = khanda.filter((c) => c.metadata?.subsection_upadafa === "२");
  results.push({
    name: "दफा ५१७ void-list खण्ड under उपदफा (२)",
    ok: voidListKhanda.length >= 11,
    detail: `found ${voidListKhanda.length} खण्ड under उपदफा २ (expected >= 11)`,
  });

  const kaBody = voidListKhanda
    .filter((c) => c.metadata?.clause_khanda === "क")
    .map(chunkBody)
    .join("\n");
  results.push({
    name: "दफा ५१७ (क) includes तर exception list",
    ok: /तर देहायको अवस्थामा/.test(kaBody) && /व्यापारको ख्याति खरिद/.test(kaBody),
    detail: kaBody ? "merged (क)+तर+exceptions" : "missing (क) body",
  });

  const upadafa = filterSectionUpadafa(chunks, "517");
  const upaBodies = upadafa.map(chunkBody).join("\n");
  for (const [label, needle] of [
    ["(२) देहाय बमोजिमका", "देहाय बमोजिमका करार बदर"],
    ["(३) प्रारम्भदेखि", "प्रारम्भदेखि नै अमान्य"],
    ["(४) कुनै अंश", "कुनै अंश बदर"],
  ] as const) {
    results.push({
      name: `दफा ५१७ उपदफा ${label}`,
      ok: upaBodies.includes(needle),
      detail: upaBodies.includes(needle) ? "found" : "missing",
    });
  }

  return results;
}

function parseChunks(
  rule: IndexingRule,
  text: string,
  inputFormat: "markers" | "indented"
): IngestChunk[] {
  const pythonChunks = parseNepaliLawText(text, rule, { inputFormat });
  return nepaliLawChunksToIngest(pythonChunks, rule);
}

function compareMarkersVsIndented(rule: IndexingRule): void {
  const canonicalPath = path.join(process.cwd(), "Lawfiles", rule.sourceText);
  const structuredPath = path.join(
    process.cwd(),
    "Lawfiles",
    rule.sourceText.replace("lawComission/", "lawComission/.structured/")
  );
  if (!fs.existsSync(canonicalPath) || !fs.existsSync(structuredPath)) {
    console.log("  (skip compare — canonical or structured file missing)");
    return;
  }

  const markers = parseChunks(
    rule,
    fs.readFileSync(canonicalPath, "utf-8"),
    "markers"
  );
  const indented = parseChunks(
    rule,
    fs.readFileSync(structuredPath, "utf-8"),
    "indented"
  );

  const pin = (chunks: IngestChunk[], section: string, type: string) =>
    chunks.filter(
      (c) => c.sectionLabel === section && c.metadata?.chunk_type === type
    ).length;

  console.log("\n  Markers vs indented (pin sections):");
  if (rule.id === "criminal-procedure") {
    console.log(
      `    दफा १४ उपदफा: markers=${pin(markers, "14", "upadafa")} indented=${pin(indented, "14", "upadafa")}`
    );
  }
  if (rule.id === "civil-code") {
    const khanda2 = (chunks: IngestChunk[]) =>
      chunks.filter(
        (c) =>
          c.sectionLabel === "517" &&
          c.metadata?.chunk_type === "khanda" &&
          c.metadata?.subsection_upadafa === "२"
      ).length;
    console.log(
      `    दफा ५१७ खण्ड under (२): markers=${khanda2(markers)} indented=${khanda2(indented)}`
    );
  }
  console.log(`    total chunks: markers=${markers.length} indented=${indented.length}`);
}

async function main() {
  const idx = process.argv.indexOf("--rule");
  const ruleId = idx >= 0 ? process.argv[idx + 1] : "criminal-procedure";
  const compare = process.argv.includes("--compare");
  const rule = getIndexingRuleById(ruleId);
  if (!rule) throw new Error(`Unknown rule: ${ruleId}`);

  const structuredPath = path.join(
    process.cwd(),
    "Lawfiles",
    rule.sourceText.replace("lawComission/", "lawComission/.structured/")
  );
  if (!fs.existsSync(structuredPath)) {
    console.warn(
      `Warning: structured file missing (${structuredPath}). Run npm run normalize-lawcomission first.`
    );
  }

  const chunks = await buildChunksForRule(rule);
  console.log(`Rule: ${rule.id}, chunks: ${chunks.length}`);

  if (compare) {
    compareMarkersVsIndented(rule);
  }

  const pins: PinResult[] = [];
  if (ruleId === "criminal-procedure") {
    pins.push(...validateDafa14(chunks));
  }
  if (ruleId === "civil-code") {
    pins.push(...validateDafa517(chunks));
  }

  let failed = 0;
  for (const pin of pins) {
    const mark = pin.ok ? "PASS" : "FAIL";
    if (!pin.ok) failed += 1;
    console.log(`  [${mark}] ${pin.name}: ${pin.detail}`);
  }

  if (pins.length === 0) {
    console.log("  (no section pins for this rule)");
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
