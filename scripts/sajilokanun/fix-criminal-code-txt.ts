/**
 * Repair मुलुकी अपराध संहिता txt from the garbled lawComission export.
 *
 * Usage:
 *   npm run fix-criminal-code-txt
 */
import fs from "fs";
import path from "path";
import { cleanMixedLegacy, devanagariRatio } from "../../src/lib/sajilokanun/pdf-extract";
import { applyWordFixes } from "../../src/lib/sajilokanun/text-clean";

const OUTPUT = path.join(
  process.cwd(),
  "Lawfiles/lawComission/मुलुकी अपराध संहिता, २०७४.txt"
);
const SOURCE = path.join(
  process.cwd(),
  "Lawfiles/lawComission/मलुकु ी अपराध संहिता, २०७४.txt"
);
const INPUT = fs.existsSync(SOURCE) ? SOURCE : OUTPUT;

const CRIMINAL_CODE_FIXES: [RegExp, string][] = [
  [/िनधार्रण/g, "र"],
  [/निधार्रण/g, "र"],
  [/सम्झनु\s+सम्झनु/g, "सम्झनु"],
  [/सम्झनु\s*पछर्/g, "सम्झनु पर्छ"],
  [/प्रावधानहरुृ/g, "प्रावधानहरू"],
  [/साा\s+स्कृतिक/g, "सांस्कृतिक"],
  [/रहेकोछ/g, "रहेको छ"],
  [/गाउापालिका/g, "गाउँपालिका"],
  [/गनर्/g, "गर्न"],
  [/िकनारा/g, "किनारा"],
  [/कारबहा/g, "कारबाही"],
  [/सुनुवाई/g, "सुनुवाइ"],
  [/समेतला\s*ई/g, "समेतलाई"],
  [/समि\s*ितको/g, "समितिको"],
  [/निय\s+ुक्त/g, "नियुक्त"],
  [/व्यङ\s+्ग्य/g, "व्यङ्ग्य"],
  [/ण्\s*\(/g, "("],
  [/पााच/g, "पाँच"],
  [/रूपैयाा/g, "रूपैयाँ"],
  [/हाुदैन/g, "हुँदैन"],
  [/जासूस\s+ी/g, "जासूसी"],
  [/बम\s+समेत/g, "बमोजिम समेत"],
  [/kg\{?\]?5/g, "पर्नेछ"],
  [/^Ps\s*$/gm, "५"],
  [/^k\|;f\/0f ug\{\s*\.\s*$/gm, "प्रसारण गर्न ।"],
  [/^b\|i6Jo\s*$/gm, "द्रष्टव्य"],
  // Garbled "पाउने" from Preeti M / mixed export before colons
  [/\s+पाउने\s*[ः:–—]\s*/g, ": "],
  [/\s+पाउने\s+M[–—-]?/g, ": "],
  [/भन्नाले\s+पाउने\s+/g, "भन्नाले "],
  [/^(\([क-ह०-९]+\)\s*)पाउने\s+/gm, "$1"],
  [/\s+पाउने\s+(?=\()/g, " "],
  [/पाउने\s+“/g, "“"],
  [/पाउने\s+पाउने/g, "पाउने"],
  [/प्राप्त\s+पाउने\s+/g, "प्राप्त "],
  [/वा\s+पाउने\s+/g, "वा "],
  [/का\s+पाउने\s+/g, "का "],
  [/को\s+पाउने\s+/g, "को "],
  [/समूह\s+पाउने\s+/g, "समूह "],
  [/([०-९])\s+पाउने\s+बमोजिम/g, "$1 बमोजिम"],
  [/र\s+र\s+फौजदारी/g, "र फौजदारी"],
  [/\s+(\d+)\s+पाउने\s+बमोजिम/g, " $1 बमोजिम"],
  [/पाउने\s+न्यायिक/g, "न्यायिक"],
  [/पाउने\s+दश/g, "दश"],
  [/ऐनपाउने/g, "ऐन"],
  [/का\s+म\s+/g, "काम "],
  [/आफ्नो\s+्नो/g, "आफ्नो"],
  [/रूपैयााभन्दा/g, "रूपैयाँभन्दा"],
  [/अन्\s+फिरादपत्र/g, " र फौजदारी"],
  [/पाउने\s+्र/g, "प्र"],
  [/पाउने\s+ुरा/g, "पूरा"],
  [/पाउने\s+ुरातात्विक/g, "पुरातात्विक"],
  [/दफा\s+पाउने\s+/g, "दफा "],
  [/पाउने\s+।/g, " ।"],
  [/भत्काउा\s+दा/g, "भत्काउँदा"],
  [/लापर\s+बाही/g, "लापरबाही"],
  [/:\s{2,}/g, ": "],
  [/,\s*,/g, ","],
];

function applyCriminalCodeFixes(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CRIMINAL_CODE_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function convertLine(line: string): string {
  let converted = cleanMixedLegacy(line);
  converted = applyCriminalCodeFixes(converted);
  converted = applyWordFixes(converted);
  return converted.trimEnd();
}

function postProcess(text: string): string {
  let result = text;
  for (let i = 0; i < 3; i++) {
    result = applyCriminalCodeFixes(result);
    result = applyWordFixes(result);
  }
  result = result.replace(/सजाय\s+र\s+अन्तरिम/g, "सजाय निर्धारण, अन्तरिम");
  return result;
}

function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Source not found: ${INPUT}`);
  }

  const raw = fs.readFileSync(INPUT, "utf-8");
  const beforeRatio = devanagariRatio(raw);

  let text = raw.split("\n").map(convertLine).join("\n");
  text = postProcess(text);

  fs.writeFileSync(OUTPUT, text, "utf-8");

  const latinLines = text
    .split("\n")
    .map((l, i) => ({ i: i + 1, l }))
    .filter(({ l }) => /[a-zA-Z]{2,}/.test(l));
  const bogusPaune = (text.match(/\S+\s+पाउने\s*:/g) ?? []).length;

  console.log(`Output: ${OUTPUT}`);
  console.log(
    `Devanagari: ${(beforeRatio * 100).toFixed(1)}% → ${(devanagariRatio(text) * 100).toFixed(1)}%`
  );
  console.log(`Latin lines: ${latinLines.length}, bogus पाउने before ':': ${bogusPaune}`);
}

main();
