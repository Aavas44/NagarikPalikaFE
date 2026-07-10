import { cleanSectionTitleForMeta } from "./legal-citation";

const META_LINE =
  /^(पुस्तक|परिच्छेद\s*नं\.?|परिच्छेद\s*नाम|परिच्छेद|दफा|उपदफा|स्रोत)\s*:/;

const SOURCE_LINE = /^(\*\*)?स्रोत\s*:/;

const LIST_MARKER = /^(\([०-९]+\)|\([क-ह]\))\s*/;

function isSubMarker(marker: string): boolean {
  return /^\([क-ह]\)$/.test(marker);
}

export function isMetadataLine(line: string): boolean {
  return META_LINE.test(line.trim());
}

/** Convert pipe-separated chunk headers (LLM often copies these) to labeled lines. */
function convertPipeMetadataLine(line: string): string {
  const trimmed = line.replace(/\uFF1A/g, ":").trim();
  if (!trimmed.includes("|")) return trimmed;
  if (!/[पफ]?रिच्छेद|दफ\s*ा/.test(trimmed)) return trimmed;

  const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
  const rows: string[] = [];

  for (const part of parts) {
    const chapter = part.match(
      /^[पफ]?रिच्छेद\s*([\d०-९]+)\s*[—–-]\s*(.+)$/
    );
    if (chapter) {
      rows.push(`परिच्छेद नं : ${chapter[1].trim()}`);
      rows.push(`परिच्छेद नाम : ${chapter[2].trim()}`);
      continue;
    }

    const dafa = part.match(
      /^दफ\s*ा\s*([\d०-९]+(?:\.[\d०-९]+)?)\s*[—–-]\s*(.+)$/
    );
    if (dafa) {
      rows.push(
        ...normalizeDafaMetaLine(
          `दफा : ${dafa[1].trim()} — ${dafa[2].trim()}`
        )
      );
      continue;
    }

    if (part.length > 5 && !/^p\./i.test(part)) {
      rows.push(`पुस्तक : ${part}`);
    }
  }

  return rows.length > 0 ? rows.join("\n") : trimmed;
}

/** Split combined metadata (one line) into separate labeled lines. */
export function splitInlineMetadata(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }

    if (/^(\*\*)?स्रोत(\*\*)?\s*:/.test(trimmed)) {
      result.push(trimmed);
      continue;
    }

    const fromPipe = convertPipeMetadataLine(trimmed);
    const expanded = fromPipe.replace(
      /\s+(?=(?:पुस्तक|परिच्छेद\s*नं\.?|परिच्छेद\s*नाम|दफा|उपदफा)\s*:)/g,
      "\n"
    );

    for (const sub of expanded.split("\n")) {
      const normalized = sub
        .trim()
        .replace(/^(परिच्छेद)(नं)/, "$1 $2")
        .replace(/^(परिच्छेद)(नाम)/, "$1 $2");

      if (/^दफ\s*ा\s*:/.test(normalized)) {
        result.push(...normalizeDafaMetaLine(normalized));
      } else {
        result.push(normalized);
      }
    }
  }

  return result.join("\n");
}

/** Normalize metadata layout before display or further parsing. */
export function normalizeAnswerMetadata(text: string): string {
  return splitInlineMetadata(text.replace(/\uFF1A/g, ":"));
}

function normalizeDafaMetaLine(line: string): string[] {
  const match = line.match(/^दफ\s*ा\s*:\s*(.+)$/);
  if (!match) return [line.trim()];

  const rest = match[1].trim();
  const sectionMatch = rest.match(
    /^([\d०-९]+(?:\.[\d०-९]+)?)\s*[—–-]\s*(.+)$/
  );
  if (!sectionMatch) return [line.trim()];

  const sectionNum = sectionMatch[1];
  let tail = sectionMatch[2];

  const dupRe = new RegExp(`\\s${sectionNum}[\\u0964.]\\s`);
  const dupIdx = tail.search(dupRe);
  let overflow = "";
  if (dupIdx >= 0) {
    overflow = tail.slice(dupIdx).trim();
    tail = tail.slice(0, dupIdx).trim();
  }

  const title = cleanSectionTitleForMeta(tail);
  const metaLine = `दफा : ${sectionNum} — ${title}`;
  return overflow ? [metaLine, overflow] : [metaLine];
}

/** True when `(N)` starts a new clause line, not an inline cross-ref (उपदफा (१) बमोजिम). */
function shouldInsertClauseLineBreak(before: string): boolean {
  const tail = before.trimEnd();
  if (/[\d०-९]\.\s*$/.test(tail)) return false;
  if (/(?:उपदफा|खण्ड)$/.test(tail)) return false;
  if (/दफा(?:\s[\d०-९]+)?$/.test(tail)) return false;
  if (/(?:वा|र|,|बमोजिम)$/.test(tail)) return false;
  return true;
}

function insertClauseLineBreaks(text: string): string {
  return text.replace(/\s+(?=\([०-९]+\))/g, (match, offset, str) => {
    if (/\n/.test(match)) return "\n";
    const before = str.slice(0, offset);
    return shouldInsertClauseLineBreak(before) ? "\n" : " ";
  });
}

/** Like numbered clauses — skip cross-refs such as "खण्ड (क), (ख), (ग) वा (घ)". */
function insertKhandaLineBreaks(text: string): string {
  return text.replace(/\s+(?=\([क-ह]\))/g, (match, offset, str) => {
    if (/\n/.test(match)) return match;
    const before = str.slice(0, offset);
    return shouldInsertClauseLineBreak(before) ? "\n  " : " ";
  });
}

/** Join "(N) उपदफा" stub lines with following "(M) बमोजिम …" cross-ref tails. */
function mergeCrossRefClauseLines(text: string): string {
  const lines = text.split("\n");
  const merged: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      merged.push("");
      continue;
    }

    const prev = merged.length > 0 ? merged[merged.length - 1].trim() : "";
    const crossRefTail = /^\([०-९]+\)\s*बमोजिम/.test(trimmed);
    const prevUpadafaStub = /\([०-९]+\)\s*उपदफा\s*$/.test(prev);

    if (prev && crossRefTail && prevUpadafaStub) {
      merged[merged.length - 1] = `${prev} ${trimmed}`;
      continue;
    }

    merged.push(line);
  }

  return merged.join("\n");
}

/** Insert line breaks before उपदफा / clause markers for readable list display. */
export function formatLegalLists(text: string): string {
  const normalized = splitInlineMetadata(text);
  const lines = normalized.split("\n");
  const meta: string[] = [];
  let i = 0;

  while (i < lines.length && META_LINE.test(lines[i].trim())) {
    meta.push(lines[i]);
    i++;
  }

  while (i < lines.length && !lines[i].trim()) i++;

  const body = lines.slice(i).join("\n").trim();
  if (!body) return normalized;

  const formattedBody = insertKhandaLineBreaks(
    insertClauseLineBreaks(
      mergeCrossRefClauseLines(body.replace(/[ः:]\s*[–—-]\s*/g, ":\n"))
    )
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (meta.length === 0) return formattedBody;
  return [...meta, "", formattedBody].join("\n");
}

export type AnswerSegment =
  | { type: "meta"; text: string }
  | { type: "source"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: AnswerListItem[] };

export type AnswerListItem = {
  marker: string;
  text: string;
  subitems?: AnswerListItem[];
};

export function parseLegalAnswer(text: string): AnswerSegment[] {
  const formatted = formatLegalLists(text);
  const lines = formatted.split("\n");
  const segments: AnswerSegment[] = [];
  const meta: string[] = [];
  let i = 0;

  while (i < lines.length && META_LINE.test(lines[i].trim())) {
    meta.push(lines[i].trim());
    i++;
  }

  if (meta.length > 0) {
    segments.push({ type: "meta", text: meta.join("\n") });
  }

  while (i < lines.length && !lines[i].trim()) i++;

  const bodyLines = lines.slice(i);
  let paragraph = "";
  let listItems: AnswerListItem[] = [];
  let currentMain: AnswerListItem | null = null;

  function flushParagraph() {
    const trimmed = paragraph.trim();
    if (trimmed) segments.push({ type: "paragraph", text: trimmed });
    paragraph = "";
  }

  function flushList() {
    if (listItems.length === 0) return;
    segments.push({
      type: "list",
      ordered: /^\([०-९]+\)$/.test(listItems[0].marker),
      items: listItems,
    });
    listItems = [];
    currentMain = null;
  }

  for (const rawLine of bodyLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (SOURCE_LINE.test(line)) {
      flushParagraph();
      flushList();
      const sourceText = line
        .replace(/^\*\*स्रोत\s*:\*\*\s*/, "")
        .replace(/^स्रोत\s*:\s*/, "")
        .trim();
      segments.push({
        type: "source",
        text: sourceText || line.replace(/^\*\*|\*\*$/g, "").trim(),
      });
      continue;
    }

    const match = line.match(LIST_MARKER);
    if (match) {
      flushParagraph();
      const marker = match[1];
      const itemText = line.slice(match[0].length).trim();

      if (
        currentMain &&
        /^\([०-९]+\)$/.test(marker) &&
        /^बमोजिम/.test(itemText) &&
        /(?:^|\s)उपदफा\s*$/u.test(currentMain.text.trim())
      ) {
        currentMain.text = `${currentMain.text.trim()} ${marker} ${itemText}`.replace(
          /\s+/g,
          " "
        );
        continue;
      }

      if (isSubMarker(marker)) {
        const subitem = { marker, text: itemText };
        if (currentMain) {
          currentMain.subitems = [...(currentMain.subitems ?? []), subitem];
        } else {
          listItems.push(subitem);
        }
      } else {
        currentMain = { marker, text: itemText };
        listItems.push(currentMain);
      }
      continue;
    }

    if (listItems.length > 0) {
      flushList();
    }
    paragraph = paragraph ? `${paragraph} ${line}` : line;
  }

  flushParagraph();
  flushList();
  return segments;
}
