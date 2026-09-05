/**
 * Batch-fix district court petition DOCX templates:
 * - remove leading empty paragraphs after the document header start
 * - ensure संलग्न कागज प्रमाण blanks have fillable {संलग्न कागज प्रमाण N} vars
 * - remove misplaced evidence vars on personal-detail lines
 * - grammar: कानूनबमोजिम → कानूनी बमोजिम; collapse double danda; ठिक→ठीक where needed
 *
 * Usage:
 *   npx tsx scripts/fix-updated-sk-templates.ts
 *   npx tsx scripts/fix-updated-sk-templates.ts --dir "/Users/seva/Downloads/templates_updated"
 */
import fs from "fs";
import path from "path";
import PizZip from "pizzip";

const DEFAULT_DIR = "/Users/seva/Downloads/templates_updated";

const DEV_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] as const;

function evidenceVar(n: number): string {
  const digit = DEV_DIGITS[n] ?? String(n);
  return `{संलग्न_कागज_प्रमाण_${digit}}`;
}

function paragraphPlainText(paragraphXml: string): string {
  return paragraphXml
    .replace(/<w:tab[^/]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rewriteParagraphText(paragraphXml: string, newText: string): string {
  const pPrMatch = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/i);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const openMatch = paragraphXml.match(/^<w:p\b[^>]*>/i);
  const open = openMatch ? openMatch[0] : "<w:p>";
  const escaped = newText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `${open}${pPr}<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

function fillBareEvidenceParagraphs(documentXml: string): string {
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/gi, (paragraphXml) => {
    const text = paragraphPlainText(paragraphXml);
    if (/^क\.\s*ख\.\s*ग\.\s*घ\.?$/.test(text)) {
      return rewriteParagraphText(
        paragraphXml,
        `(क) ${evidenceVar(1)} (ख) ${evidenceVar(2)} (ग) ${evidenceVar(3)} (घ) ${evidenceVar(4)}`
      );
    }
    if (/^क\.\s*ख\s*\.?$/.test(text)) {
      return rewriteParagraphText(
        paragraphXml,
        `(क) ${evidenceVar(1)} (ख) ${evidenceVar(2)}`
      );
    }
    if (/^संलग्न\s*कागजात\s*:?\s*क\.\s*ख\.\s*ग\.\s*घ\.?$/.test(text)) {
      return rewriteParagraphText(
        paragraphXml,
        `संलग्न कागजात: (क) ${evidenceVar(1)} (ख) ${evidenceVar(2)} (ग) ${evidenceVar(3)} (घ) ${evidenceVar(4)}`
      );
    }
    if (/^संलग्न\s*कागजात\s*:?\s*क\.\s*ख\.?$/.test(text)) {
      return rewriteParagraphText(
        paragraphXml,
        `संलग्न कागजात: (क) ${evidenceVar(1)} (ख) ${evidenceVar(2)}`
      );
    }
    return paragraphXml;
  });
}

function paragraphHasText(paragraphXml: string): boolean {
  return paragraphPlainText(paragraphXml).length > 0;
}

function removeLeadingEmptyParagraphs(documentXml: string): string {
  return documentXml.replace(
    /(<w:body[^>]*>)([\s\S]*?)(<\/w:body>)/i,
    (_full, open: string, body: string, close: string) => {
      const sectMatch = body.match(/([\s\S]*?)(<w:sectPr\b[\s\S]*<\/w:sectPr>\s*)$/i);
      let main = sectMatch ? sectMatch[1] : body;
      const sect = sectMatch ? sectMatch[2] : "";

      let changed = true;
      while (changed) {
        changed = false;
        main = main.replace(/^\s*(<w:p\b[\s\S]*?<\/w:p>)/i, (match, paragraphXml: string) => {
          if (!paragraphHasText(paragraphXml)) {
            changed = true;
            return "";
          }
          return match;
        });
      }

      return `${open}${main}${sect}${close}`;
    }
  );
}

function applyGrammarFixes(xml: string): string {
  return xml
    .replace(/कानूनबमोजिम/g, "कानूनी बमोजिम")
    .replace(/कानुन बमोजिम/g, "कानूनी बमोजिम")
    .replace(/कानुनबमोजिम/g, "कानूनी बमोजिम")
    .replace(/ठिक साँचो हो/g, "ठीक साँचो छ")
    .replace(/ठिक साँचो छ/g, "ठीक साँचो छ")
    .replace(/लेखिएको बेहोरा ठिक साँचो हो/g, "माथि लेखिएको बेहोरा ठीक साँचो छ")
    .replace(/।\s*।/g, "।");
}

function removeMisplacedEvidenceVars(xml: string): string {
  // Wrongly inserted before personal-detail labels
  return xml
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=नाम)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=लिङ्ग)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=उमेर)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=ठेगाना)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=बाबु)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=बाजे)/g,
      ""
    )
    .replace(
      /\{संलग्न[_\s]?कागज[_\s]?प्रमाण[_\s]?[०-९0-9]+\}\s*(?=नागरिकता)/g,
      ""
    );
}

function normalizeEvidencePlaceholders(xml: string): string {
  // Collapse accidental duplicates: {…१} {…१} → keep one, then rename
  xml = xml.replace(
    /(\{संलग्न[_ ]?कागज[_ ]?प्रमाण[_ ]?[०-९0-9]+\})\s*\1/g,
    "$1"
  );

  // Rename underscore / mixed forms to spaced Nepali keys
  xml = xml.replace(
    /\{संलग्न[_ ]?कागज[_ ]?प्रमाण[_ ]?([०-९0-9]+)\}/g,
    (_m, digit: string) => {
      const n = "०१२३४५६७८९".includes(digit)
        ? "०१२३४५६७८९".indexOf(digit)
        : Number(digit);
      return evidenceVar(Number.isFinite(n) ? n : 1);
    }
  );

  // संलग्न कागजात क. ख. ग. घ.  (or subset) without placeholders
  xml = xml.replace(
    /संलग्न\s*कागजात\s*:?\s*क\.\s*ख\.\s*ग\.\s*घ\./g,
    `संलग्न कागजात: (क) ${evidenceVar(1)} (ख) ${evidenceVar(2)} (ग) ${evidenceVar(3)} (घ) ${evidenceVar(4)}`
  );
  xml = xml.replace(
    /संलग्न\s*कागजात\s*:?\s*क\.\s*ख\./g,
    `संलग्न कागजात: (क) ${evidenceVar(1)} (ख) ${evidenceVar(2)}`
  );

  // Standalone क. ख. ग. घ. block (e.g. छुट प्रमाण form)
  xml = xml.replace(
    /(?<!\{)क\.\s*ख\.\s*ग\.\s*घ\.(?![\w{])/g,
    `(क) ${evidenceVar(1)} (ख) ${evidenceVar(2)} (ग) ${evidenceVar(3)} (घ) ${evidenceVar(4)}`
  );
  xml = xml.replace(
    /(?<!\{)क\.\s*ख\.(?!\s*ग)(?![\w{])/g,
    `(क) ${evidenceVar(1)} (ख) ${evidenceVar(2)}`
  );

  // (क) … (ख) with only whitespace between after evidence header context —
  // also fix bare (क)(ख) lines that have no brace after (क)
  xml = xml.replace(
    /\(क\)(?![^{]{0,5}\{)(\s*)\(ख\)(?![^{]{0,5}\{)/g,
    `(क) ${evidenceVar(1)}$1(ख) ${evidenceVar(2)}`
  );
  xml = xml.replace(
    /\(ग\)(?![^{]{0,5}\{)(\s*)\(घ\)(?![^{]{0,5}\{)/g,
    `(ग) ${evidenceVar(3)}$1(घ) ${evidenceVar(4)}`
  );

  // Ensure space between var and next label: `{…१}(ख)` → `{…१} (ख)`
  xml = xml.replace(
    /(\{संलग्न[_ ]कागज[_ ]प्रमाण[_ ]?[०-९0-9]+\})\s*\(/g,
    "$1 ("
  );

  return xml;
}

/** Keep shared field keys consistent across templates. */
function normalizeConsistentKeys(xml: string): string {
  // Court header: श्री {…} जिल्ला अदालत / अदालतमा → जिल्ला_अदालतको_नाम
  // Do NOT change judge-name uses like "माननीय न्यायाधीश श्री {…}"
  xml = xml.replace(
    /श्री\s*\{अदालत_वा_निकायको_नाम\}\s*(जिल्ला\s*)?अदालत/g,
    "श्री {जिल्ला_अदालतको_नाम} जिल्ला अदालत"
  );
  xml = xml.replace(
    /श्री\s*\{अदालत_वा_निकायको_नाम\}अदालत/g,
    "श्री {जिल्ला_अदालतको_नाम} अदालत"
  );

  // Judge name uses of the same old key → न्यायाधीशको_नाम
  xml = xml.replace(
    /माननीय\s*न्यायाधीश\s*श्री\s*\{अदालत_वा_निकायको_नाम\}/g,
    "माननीय न्यायाधीश श्री {न्यायाधीशको_नाम}"
  );
  xml = xml.replace(
    /\{अदालत_वा_निकायको_नाम\}/g,
    "{जिल्ला_अदालतको_नाम}"
  );

  // Evidence vars with spaces → underscore (same meaning)
  xml = xml.replace(
    /\{संलग्न कागज प्रमाण ([०-९0-9]+)\}/g,
    (_m, digit: string) => {
      const n = "०१२३४५६७८९".includes(digit)
        ? "०१२३४५६७८९".indexOf(digit)
        : Number(digit);
      return evidenceVar(Number.isFinite(n) ? n : 1);
    }
  );

  return xml;
}

/**
 * Near-bottom signature: keep/ensure
 *   निवेदक
 *   {निवेदकको_नाम}
 * both right-aligned. Bare "निवेदक" alone becomes label + name var.
 */
function replaceBottomNivedakName(documentXml: string): string {
  const paragraphs = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/gi);
  if (!paragraphs || paragraphs.length === 0) return documentXml;

  const start = Math.max(0, paragraphs.length - 18);
  const skip = new Set<number>();
  const replacements = new Map<number, string>();

  function rightAlignedParagraph(text: string, fromXml?: string): string {
    const open = fromXml?.match(/^<w:p\b[^>]*>/i)?.[0] ?? "<w:p>";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `${open}<w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
  }

  for (let i = start; i < paragraphs.length; i++) {
    const text = paragraphPlainText(paragraphs[i]);
    if (text === "निवेदक") {
      const next = paragraphs[i + 1];
      const nextText = next ? paragraphPlainText(next) : "";
      if (nextText === "{निवेदकको_नाम}") {
        replacements.set(i, rightAlignedParagraph("निवेदक", paragraphs[i]));
        replacements.set(
          i + 1,
          rightAlignedParagraph("{निवेदकको_नाम}", paragraphs[i + 1])
        );
      } else {
        // Replace lone निवेदक with label + name var (two paragraphs)
        replacements.set(
          i,
          `${rightAlignedParagraph("निवेदक", paragraphs[i])}${rightAlignedParagraph("{निवेदकको_नाम}")}`
        );
        if (nextText === "{विवरण_भर्नुहोस्}") skip.add(i + 1);
      }
      continue;
    }
    if (text === "{निवेदकको_नाम}") {
      const prev = i > 0 ? paragraphPlainText(paragraphs[i - 1]) : "";
      if (prev !== "निवेदक") {
        replacements.set(
          i,
          `${rightAlignedParagraph("निवेदक")}${rightAlignedParagraph("{निवेदकको_नाम}", paragraphs[i])}`
        );
      } else {
        replacements.set(
          i,
          rightAlignedParagraph("{निवेदकको_नाम}", paragraphs[i])
        );
      }
    }
  }

  if (replacements.size === 0 && skip.size === 0) return documentXml;

  let index = 0;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/gi, (paragraphXml) => {
    const current = index;
    index += 1;
    if (skip.has(current)) return "";
    return replacements.get(current) ?? paragraphXml;
  });
}

function processDocx(filePath: string): {
  changed: boolean;
  notes: string[];
} {
  const original = fs.readFileSync(filePath);
  const zip = new PizZip(original);
  const notes: string[] = [];
  let changed = false;

  for (const fileName of Object.keys(zip.files)) {
    if (!fileName.startsWith("word/") || !fileName.endsWith(".xml")) continue;
    if (zip.files[fileName].dir) continue;

    let xml = zip.files[fileName].asText();
    const before = xml;

    if (fileName === "word/document.xml") {
      const withoutLeading = removeLeadingEmptyParagraphs(xml);
      if (withoutLeading !== xml) {
        notes.push("removed leading empty paragraphs");
        xml = withoutLeading;
      }
    }

    xml = applyGrammarFixes(xml);
    xml = removeMisplacedEvidenceVars(xml);
    xml = normalizeEvidencePlaceholders(xml);
    xml = normalizeConsistentKeys(xml);
    if (fileName === "word/document.xml") {
      xml = fillBareEvidenceParagraphs(xml);
      const withNivedak = replaceBottomNivedakName(xml);
      if (withNivedak !== xml) {
        notes.push("bottom निवेदक → {निवेदकको_नाम}");
        xml = withNivedak;
      }
    }

    if (xml !== before) {
      zip.file(fileName, xml);
      changed = true;
    }
  }

  if (changed) {
    const out = zip.generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    fs.writeFileSync(filePath, out);
  }

  return { changed, notes };
}

function main() {
  const dirArg = process.argv.indexOf("--dir");
  const dir =
    dirArg >= 0 && process.argv[dirArg + 1]
      ? process.argv[dirArg + 1]
      : DEFAULT_DIR;

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".docx"))
    .sort();

  let changedCount = 0;
  for (const file of files) {
    const full = path.join(dir, file);
    const { changed, notes } = processDocx(full);
    if (changed) {
      changedCount += 1;
      console.log(`fixed: ${file}${notes.length ? ` (${notes.join("; ")})` : ""}`);
    } else {
      console.log(`ok: ${file}`);
    }
  }

  console.log(
    JSON.stringify({ total: files.length, changed: changedCount }, null, 2)
  );
}

main();
