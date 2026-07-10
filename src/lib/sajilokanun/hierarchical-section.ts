import { citationFromChunk, formatCitationBlock } from "./chunk-metadata";
import { getProvisionBody, cleanProvisionBodyForDisplay } from "./provision-body";
import { toArabicDigits, toNepaliNumberDisplay } from "./nepali-digits";
import type { MatchedChunk } from "./supabase";

/** Devanagari clause order (क, ख, ग, …) — matches parse_nepali_law.py */
const KHANDA_ORDER: Record<string, number> = {
  "क": 1,
  "ख": 2,
  "ग": 3,
  "घ": 4,
  "ङ": 5,
  "च": 6,
  "छ": 7,
  "ज": 8,
  "झ": 9,
  "ञ": 10,
  "ट": 11,
  "ठ": 12,
  "ड": 13,
  "ढ": 14,
  "ण": 15,
  "त": 16,
  "थ": 17,
  "द": 18,
  "ध": 19,
  "न": 20,
  "प": 21,
  "फ": 22,
  "ब": 23,
  "भ": 24,
  "म": 25,
  "य": 26,
  "र": 27,
  "ल": 28,
  "व": 29,
  "श": 30,
  "ष": 31,
  "स": 32,
  "ह": 33,
};

export type ChunkHierarchy = {
  chunkType: string;
  upadafa: number;
  khanda: string | null;
  khandaOrder: number;
};

function headerBlock(content: string): string {
  const blank = content.indexOf("\n\n");
  return blank >= 0 ? content.slice(0, blank) : content;
}

export function parseChunkHierarchy(content: string): ChunkHierarchy {
  const header = headerBlock(content);
  const typeMatch = header.match(/प्रकार\s*:\s*(\w+)/);
  let chunkType = typeMatch?.[1] ?? "dafa";
  if (!typeMatch) {
    if (/खण्ड\s*:/.test(header)) chunkType = "khanda";
    else if (/उपदफा\s*:/.test(header)) chunkType = "upadafa";
  }

  const upMatch = header.match(/उपदफा\s*:\s*([\d०-९]+)/);
  const upadafa = upMatch ? Number(toArabicDigits(upMatch[1])) : 0;

  const khMatch = header.match(/खण्ड\s*:\s*([^\n]+)/);
  const khanda = khMatch?.[1]?.trim() ?? null;
  const khandaOrder = khanda ? (KHANDA_ORDER[khanda] ?? khanda.charCodeAt(0)) : 0;

  return { chunkType, upadafa, khanda, khandaOrder };
}

function isDigitMarker(marker: string): boolean {
  return /^[०-९\d]+$/.test(marker);
}

function isKhandaMarker(marker: string): boolean {
  return marker in KHANDA_ORDER;
}

function countKhandaMarkers(text: string): number {
  return (text.match(/\([क-ज्ञ]\)/gu) ?? []).length;
}

function ensureKhandaPrefix(leaf: string, text: string): string {
  const trimmed = text.trim();
  const markerRe = new RegExp(`^\\(\\s*${leaf}\\s*\\)\\s*`, "u");
  if (markerRe.test(trimmed)) return trimmed;
  return `(${leaf}) ${trimmed}`;
}

function markerSortNum(marker: string): number {
  return Number(toArabicDigits(marker)) || 0;
}

function khandaSortNum(marker: string): number {
  return KHANDA_ORDER[marker] ?? marker.charCodeAt(0);
}

/** Parse "परिभाषाः -> (१) -> (क) text" or "दफा शीर्षक -> (१) text" into path + clean text. */
export function parseProvisionPath(body: string): {
  path: string[];
  text: string;
} {
  let text = body.trim();
  text = text.replace(/^परिभाषाः(?:\s*->\s*|\s*:\s*)/, "");

  const arrowAnchor = text.search(/\s*->\s*\(/);
  if (arrowAnchor > 0) {
    text = text.slice(arrowAnchor).trim();
  }

  const markers: string[] = [];
  while (true) {
    const arrow = text.match(/^->\s*\(([०-९क-ह]+)\)\s*/);
    if (arrow) {
      markers.push(arrow[1]);
      text = text.slice(arrow[0].length);
      continue;
    }
    const direct = text.match(/^\(([०-९क-ह]+)\)\s*/);
    if (markers.length === 0 && direct) {
      markers.push(direct[1]);
      text = text.slice(direct[0].length);
      continue;
    }
    break;
  }

  return { path: markers, text: text.trim() };
}

/** Sort by legal breadcrumb path, not DB chunk_type. */
export function breadcrumbSortKey(path: string[]): number {
  if (path.length === 0) return 0;

  if (path.length === 1) {
    const m = path[0];
    if (isDigitMarker(m)) return 500 + markerSortNum(m);
    return 100 + khandaSortNum(m);
  }

  if (path.length === 2) {
    const [parent, child] = path;
    if (isDigitMarker(parent) && !isDigitMarker(child)) {
      if (markerSortNum(parent) === 1) return 100 + khandaSortNum(child);
      if (markerSortNum(parent) === 2) {
        const k = khandaSortNum(child);
        return k === 1 ? 511 : 525 + k;
      }
      return 800 + markerSortNum(parent) * 50 + khandaSortNum(child);
    }
  }

  if (path.length === 3) {
    const [p, mid, leaf] = path;
    if (p === "२" && mid === "क" && isDigitMarker(leaf)) {
      return 516 + markerSortNum(leaf);
    }
  }

  return 9000 + path.length;
}

function displayMarker(marker: string): string {
  if (isDigitMarker(marker)) {
    return `(${toNepaliNumberDisplay(marker)})`;
  }
  return `(${marker})`;
}

function formatClauseLine(path: string[], text: string): string {
  if (path.length === 0) return text;
  if (path.length === 1) {
    return `${displayMarker(path[0])} ${text}`;
  }
  const leaf = path[path.length - 1];
  const indent = "    ".repeat(path.length - 1);
  return `${indent}${displayMarker(leaf)} ${text}`;
}

/** Flow sibling खण्ड under one उपदफा — no blank lines between clauses. */
function formatUpadafaKhandaBlock(khandas: ParsedChunk[]): string {
  if (khandas.length === 0) return "";

  if (khandas.length === 1) {
    const item = khandas[0];
    const leaf = item.path[item.path.length - 1];
    const prefixed = ensureKhandaPrefix(leaf, item.text);
    if (countKhandaMarkers(prefixed) > 1) {
      const indent = "    ".repeat(Math.max(1, item.path.length - 1));
      return `${indent}${prefixed}`;
    }
    return formatClauseLine(item.path, item.text);
  }

  return khandas
    .map((item) => formatClauseLine(item.path, item.text))
    .join("\n");
}

type ParsedChunk = {
  chunk: MatchedChunk;
  path: string[];
  text: string;
  sortKey: number;
  isIntro: boolean;
};

function collapseDuplicateTitleIntro(text: string): string {
  const trimmed = text.trim();
  const dup = trimmed.match(/^(.+?)\s*:+\s*\1\s*:*\s*$/u);
  if (dup) return "";
  return trimmed;
}

function parseChunkForDisplay(chunk: MatchedChunk): ParsedChunk {
  const { chunkType, upadafa: upNum, khanda } = parseChunkHierarchy(chunk.content);
  const body = cleanProvisionBodyForDisplay(getProvisionBody(chunk.content));
  let { path, text } = parseProvisionPath(body);

  if (chunkType === "dafa") {
    const intro = collapseDuplicateTitleIntro(
      text.replace(/^परिभाषाः\s*:\s*परिभाषाः\s*/, "परिभाषाः ").trim()
    );
    return {
      chunk,
      path: [],
      text: intro,
      sortKey: 0,
      isIntro: true,
    };
  }

  if (chunkType === "tar") {
    const tarMatch = text.match(/:\s*(तर\s.+)$/u);
    const tarText = tarMatch ? tarMatch[1].trim() : text.replace(/^[^:]+:\s*/, "").trim();
    return {
      chunk,
      path: [],
      text: tarText,
      sortKey: 502.5,
      isIntro: false,
    };
  }

  if (chunkType === "upadafa" && path.length === 0) {
    if (upNum > 0) {
      path = [toNepaliNumberDisplay(String(upNum))];
    }
  }

  if (chunkType === "khanda" && upNum > 0) {
    const upMarker = toNepaliNumberDisplay(String(upNum));
    const leaf =
      khanda ??
      (path.length === 1 && isKhandaMarker(path[0]) ? path[0] : null);
    if (leaf) {
      path = [upMarker, leaf];
    }
  }

  return {
    chunk,
    path,
    text,
    sortKey: breadcrumbSortKey(path),
    isIntro: false,
  };
}

const PUNISHMENT_KHANDA_BY_UPADAFA: Record<string, string> = {
  "१": "क",
  "२": "ख",
  "३": "ग",
  "1": "क",
  "2": "ख",
  "3": "ग",
};

function isPunishmentAggregator(item: ParsedChunk): boolean {
  const trimmed = item.text.trim();
  return (
    item.path.length === 1 &&
    item.path[0] === "४" &&
    !/^बमोजिम/.test(trimmed) &&
    /देहाय\s+बमोजिम|बमोजिम\s+सजाय|सजाय\s+हुनेछ/.test(trimmed)
  );
}

/** Move बमोजिम सजाय lines under उपदफा (४) as खण्ड (क)/(ख)/(ग). */
function restructurePunishmentClauses(items: ParsedChunk[]): ParsedChunk[] {
  const hasPunishmentIntro = items.some(isPunishmentAggregator);
  if (!hasPunishmentIntro) return items;

  const absorbed = new Set<string>();
  const punishmentByUpadafa = new Map<string, ParsedChunk>();

  for (const item of items) {
    const trimmed = item.text.trim();
    if (/^उपदफा\s*$/u.test(trimmed)) {
      absorbed.add(item.chunk.id);
      continue;
    }
    if (
      item.path.length === 2 &&
      item.path[0] !== "४" &&
      /^उपदफा/.test(trimmed)
    ) {
      absorbed.add(item.chunk.id);
      continue;
    }
    if (
      item.path.length === 1 &&
      isDigitMarker(item.path[0]) &&
      item.path[0] !== "४" &&
      /^बमोजिम/.test(trimmed)
    ) {
      punishmentByUpadafa.set(item.path[0], item);
      absorbed.add(item.chunk.id);
    }
  }

  const result = items.filter((item) => !absorbed.has(item.chunk.id));

  for (const [upadafa, src] of punishmentByUpadafa) {
    const khanda = PUNISHMENT_KHANDA_BY_UPADAFA[upadafa];
    if (!khanda) continue;
    let text = src.text.trim().replace(/,\s*$/, "");
    if (!/^उपदफा\s*\(/.test(text)) {
      text = `उपदफा (${toNepaliNumberDisplay(upadafa)}) ${text}`;
    }
    result.push({
      ...src,
      path: ["४", khanda],
      text,
      sortKey: breadcrumbSortKey(["४", khanda]),
      isIntro: false,
    });
  }

  return result;
}

/** Place तर clauses after the preceding उपदफा (e.g. after (५) before (६), or after (२) before (३)). */
function fixTarClausePosition(items: ParsedChunk[]): ParsedChunk[] {
  const tarItems = items.filter(
    (item) => item.path.length === 0 && /^तर\s/.test(item.text.trim())
  );
  if (tarItems.length === 0) return items;

  const digitUpadafas = [
    ...new Set(
      items
        .filter((item) => item.path.length === 1 && isDigitMarker(item.path[0]))
        .map((item) => markerSortNum(item.path[0]))
    ),
  ].sort((a, b) => a - b);
  if (digitUpadafas.length === 0) return items;

  const maxNum = digitUpadafas[digitUpadafas.length - 1];
  const anchorNum = digitUpadafas.includes(6) ? 5 : Math.max(1, maxNum - 1);
  const sortKey = breadcrumbSortKey([String(anchorNum)]) + 0.5;

  return items.map((item) =>
    tarItems.some((tar) => tar.chunk.id === item.chunk.id)
      ? { ...item, sortKey }
      : item
  );
}

/** Reassign बमोजिम lines wrongly indexed under (१) to (२)/(३); merge (N) उपदफा stubs. */
function isUpadafaOnlyStub(text: string): boolean {
  return /^उपदफा\s*$/u.test(text.trim());
}

function isBamojimCrossRefTail(text: string): boolean {
  const trimmed = text.trim();
  return /^बमोजिम/.test(trimmed) || /^\([०-९]+\)\s*बमोजिम/.test(trimmed);
}

function normalizeBamojimContinuation(text: string): string {
  const trimmed = text.trim();
  if (/^उपदफा\s*\(/.test(trimmed)) return trimmed;
  if (/^\([०-९]+\)\s*बमोजिम/.test(trimmed)) return `उपदफा ${trimmed}`;
  if (/^बमोजिम/.test(trimmed)) return `उपदफा (१) ${trimmed}`;
  return trimmed;
}

function restructureMisplacedBamojimClauses(items: ParsedChunk[]): ParsedChunk[] {
  const hasPunishmentIntro = items.some(isPunishmentAggregator);
  if (hasPunishmentIntro) return items;

  const absorbed = new Set<string>();
  const pendingMerges: { target: string; continuation: string; source: ParsedChunk }[] = [];
  const stubTargets = new Map<string, ParsedChunk>();
  const reassigned: ParsedChunk[] = [];
  const kept: ParsedChunk[] = [];

  for (const item of items) {
    const trimmed = item.text.trim();

    if (
      item.path.length === 1 &&
      isDigitMarker(item.path[0]) &&
      isUpadafaOnlyStub(trimmed)
    ) {
      stubTargets.set(item.path[0], item);
      absorbed.add(item.chunk.id);
      continue;
    }

    if (
      item.path.length === 1 &&
      item.path[0] === "१" &&
      isBamojimCrossRefTail(trimmed)
    ) {
      absorbed.add(item.chunk.id);
      const target = /क्षतिपूर्ति|पीडित|हानि|नोक्सानी/.test(trimmed) ? "३" : "२";
      pendingMerges.push({
        target,
        continuation: normalizeBamojimContinuation(trimmed),
        source: item,
      });
      continue;
    }
    kept.push(item);
  }

  for (const [targetNum, stub] of stubTargets) {
    const orphanIdx = pendingMerges.findIndex((m) => m.target === targetNum);
    const orphan = orphanIdx >= 0 ? pendingMerges.splice(orphanIdx, 1)[0] : null;
    const targetIdx = kept.findIndex(
      (k) => k.path.length === 1 && k.path[0] === targetNum && !k.isIntro
    );

    if (orphan && targetIdx >= 0) {
      const existing = kept[targetIdx];
      kept[targetIdx] = {
        ...existing,
        text: `${existing.text.trim()} ${orphan.continuation}`.replace(/\s+/g, " "),
      };
      continue;
    }

    if (orphan) {
      reassigned.push({
        ...stub,
        path: [targetNum],
        text: orphan.continuation,
        sortKey: breadcrumbSortKey([targetNum]),
        isIntro: false,
      });
      continue;
    }

    if (targetIdx >= 0) {
      const existing = kept[targetIdx];
      if (!/\bउपदफा\b/u.test(existing.text)) {
        kept[targetIdx] = {
          ...existing,
          text: `${existing.text.trim()} उपदफा`.replace(/\s+/g, " "),
        };
      }
    } else {
      reassigned.push({
        ...stub,
        path: [targetNum],
        text: "उपदफा",
        sortKey: breadcrumbSortKey([targetNum]),
        isIntro: false,
      });
    }
  }

  for (const merge of pendingMerges) {
    const targetIdx = kept.findIndex(
      (k) => k.path.length === 1 && k.path[0] === merge.target && !k.isIntro
    );
    if (targetIdx >= 0) {
      const existing = kept[targetIdx];
      kept[targetIdx] = {
        ...existing,
        text: `${existing.text.trim()} ${merge.continuation}`.replace(/\s+/g, " "),
      };
      continue;
    }
    reassigned.push({
      ...merge.source,
      path: [merge.target],
      text: merge.continuation.startsWith("उपदफा")
        ? merge.continuation
        : `उपदफा ${merge.continuation}`,
      sortKey: breadcrumbSortKey([merge.target]),
      isIntro: false,
    });
  }

  return [...kept.filter((item) => !absorbed.has(item.chunk.id)), ...reassigned];
}

/** Fix दफा ५१७ indexing: void-list खण्ड (क)–(ठ) wrongly under (४); exception (१)–(४) misplaced. */
function restructure517VoidContractClauses(items: ParsedChunk[]): ParsedChunk[] {
  const is517 = items.some((item) =>
    /दफा\s*:\s*५१७\s*—\s*बदर हुने करार|बदर हुने करारः/.test(item.chunk.content)
  );
  if (!is517) return items;

  const result: ParsedChunk[] = [];

  for (const item of items) {
    const trimmed = item.text.trim();

    if (/^उपदफा\s*$/u.test(trimmed)) continue;

    if (
      item.path.length === 2 &&
      item.path[0] === "४" &&
      !isDigitMarker(item.path[1]) &&
      KHANDA_ORDER[item.path[1]]
    ) {
      const newPath = ["२", item.path[1]];
      result.push({
        ...item,
        path: newPath,
        sortKey: breadcrumbSortKey(newPath),
      });
      continue;
    }

    if (item.path.length === 1 && item.path[0] === "१" && /ख्याति खरिद/.test(trimmed)) {
      const newPath = ["२", "क", "१"];
      result.push({
        ...item,
        path: newPath,
        sortKey: breadcrumbSortKey(newPath),
      });
      continue;
    }

    if (item.path.length === 1 && item.path[0] === "२" && /साझेदार रहुन्जेल/.test(trimmed)) {
      const newPath = ["२", "क", "२"];
      result.push({
        ...item,
        path: newPath,
        sortKey: breadcrumbSortKey(newPath),
      });
      continue;
    }

    if (item.path.length === 1 && item.path[0] === "३" && /साझेदारी छाडिसके/.test(trimmed)) {
      const newPath = ["२", "क", "३"];
      result.push({
        ...item,
        path: newPath,
        sortKey: breadcrumbSortKey(newPath),
      });
      continue;
    }

    if (item.path.length === 1 && item.path[0] === "४" && /प्रतिस्पर्धी/.test(trimmed)) {
      const newPath = ["२", "क", "४"];
      result.push({
        ...item,
        path: newPath,
        sortKey: breadcrumbSortKey(newPath),
      });
      continue;
    }

    if (item.path.length === 0 && /^तर देहायको/.test(trimmed)) {
      result.push({ ...item, sortKey: 515 });
      continue;
    }

    if (
      item.path.length === 1 &&
      item.path[0] === "२" &&
      /देहाय बमोजिमका करार बदर/.test(trimmed)
    ) {
      result.push({ ...item, sortKey: 502 });
      continue;
    }

    if (
      item.path.length === 1 &&
      item.path[0] === "३" &&
      /प्रारम्भदेखि नै अमान्य/.test(trimmed)
    ) {
      result.push({ ...item, sortKey: 600 });
      continue;
    }

    if (
      item.path.length === 1 &&
      item.path[0] === "४" &&
      /कुनै अंश बदर/.test(trimmed)
    ) {
      result.push({ ...item, sortKey: 601 });
      continue;
    }

    result.push(item);
  }

  return result;
}

function restructureClauseTree(items: ParsedChunk[]): ParsedChunk[] {
  return fixTarClausePosition(
    restructure517VoidContractClauses(
      restructureMisplacedBamojimClauses(restructurePunishmentClauses(items))
    )
  );
}

export function hierarchySortKey(content: string): number {
  const body = getProvisionBody(content);
  const { path } = parseProvisionPath(body);
  if (path.length > 0) return breadcrumbSortKey(path);
  const { chunkType, upadafa, khandaOrder } = parseChunkHierarchy(content);
  if (chunkType === "dafa") return 0;
  if (chunkType === "upadafa") return upadafa * 10_000;
  if (chunkType === "khanda") return upadafa * 10_000 + khandaOrder;
  return 999_999;
}

export function hierarchySortKeyFromMetadata(
  metadata?: Record<string, unknown> | null
): number {
  if (!metadata) return 999_999;
  const chunkType = String(metadata.chunk_type ?? "dafa");
  const upadafa =
    Number(toArabicDigits(String(metadata.subsection_upadafa ?? "0"))) || 0;
  const khanda = String(metadata.clause_khanda ?? "");
  const khandaOrder = khanda
    ? (KHANDA_ORDER[khanda] ?? khanda.charCodeAt(0))
    : 0;

  if (chunkType === "dafa") return 0;
  if (chunkType === "upadafa") return upadafa * 10_000;
  if (chunkType === "khanda") return upadafa * 10_000 + khandaOrder;
  return 999_999;
}

export function sortChunksHierarchically(chunks: MatchedChunk[]): MatchedChunk[] {
  return [...chunks]
    .map((c) => parseChunkForDisplay(c))
    .sort((a, b) => a.sortKey - b.sortKey || a.chunk.id.localeCompare(b.chunk.id))
    .map(({ chunk }) => chunk);
}

/** Single दफा chunk: drop repeated title prefix in body. */
function dedupeSectionTitleBody(citation: ReturnType<typeof citationFromChunk>, body: string): string {
  const title = citation.sectionTitle?.replace(/\s*:\s*$/, "").trim();
  if (!title) return body;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body
    .replace(new RegExp(`^${escaped}\\s*:\\s*${escaped}\\s*:\\s*`, "u"), `${title}: `)
    .replace(new RegExp(`^${escaped}\\s*:\\s*`, "u"), "");
}

/** List every indexed sub-chunk under a दफा in readable legal list form. */
export function formatHierarchicalSectionAnswer(chunks: MatchedChunk[]): string {
  if (chunks.length === 0) return "";
  if (chunks.length === 1) {
    const parsed = parseChunkForDisplay(chunks[0]);
    const citation = citationFromChunk(chunks[0].content, chunks[0].filename);
    const provision =
      parsed.path.length > 0
        ? formatClauseLine(parsed.path, parsed.text)
        : dedupeSectionTitleBody(citation, parsed.text) || parsed.text;
    return `${formatCitationBlock(citation)}\n\n${provision}`;
  }

  const parsed = restructureClauseTree(chunks.map((chunk) => parseChunkForDisplay(chunk))).sort(
    (a, b) => a.sortKey - b.sortKey || a.chunk.id.localeCompare(b.chunk.id)
  );

  const intro = parsed.find((p) => p.isIntro);
  const anchor = intro ?? parsed[0];
  const rootCitation = citationFromChunk(anchor.chunk.content, anchor.chunk.filename);

  const lines: string[] = [formatCitationBlock(rootCitation)];
  if (intro?.text.trim()) {
    lines.push("", intro.text.trim());
  }

  const upadafaGroups = new Map<string, ParsedChunk[]>();
  const ungrouped: ParsedChunk[] = [];

  for (const item of parsed) {
    if (intro && item.chunk.id === intro.chunk.id) continue;
    if (!item.text.trim() && item.path.length === 0) continue;
    if (/^उपदफा\s*$/u.test(item.text.trim())) continue;

    if (item.path.length === 1 && isDigitMarker(item.path[0])) {
      const key = item.path[0];
      const group = upadafaGroups.get(key) ?? [];
      group.unshift(item);
      upadafaGroups.set(key, group);
      continue;
    }

    if (item.path.length >= 2 && isDigitMarker(item.path[0])) {
      const key = item.path[0];
      const group = upadafaGroups.get(key) ?? [];
      group.push(item);
      upadafaGroups.set(key, group);
      continue;
    }

    ungrouped.push(item);
  }

  const orderedUpadafas = [...upadafaGroups.keys()].sort(
    (a, b) => markerSortNum(a) - markerSortNum(b)
  );

  for (const key of orderedUpadafas) {
    const group = upadafaGroups.get(key)!;
    group.sort(
      (a, b) => a.sortKey - b.sortKey || a.chunk.id.localeCompare(b.chunk.id)
    );

    const header = group.find((item) => item.path.length === 1);
    const khandas = group.filter((item) => item.path.length >= 2);
    const remainder = group.filter((item) => item.path.length === 0);

    if (header || khandas.length > 0 || remainder.length > 0) {
      lines.push("");
    }
    if (header) {
      lines.push(formatClauseLine(header.path, header.text));
    }
    for (const item of remainder) {
      lines.push(item.text);
    }
    if (khandas.length > 0) {
      lines.push(formatUpadafaKhandaBlock(khandas));
    }
  }

  ungrouped.sort(
    (a, b) => a.sortKey - b.sortKey || a.chunk.id.localeCompare(b.chunk.id)
  );
  for (const item of ungrouped) {
    if (item.path.length === 0) {
      lines.push("", item.text);
    } else {
      lines.push("", formatClauseLine(item.path, item.text));
    }
  }

  return lines.join("\n");
}

function sectionDafaKey(chunk: MatchedChunk): string {
  const header = chunk.content.split("\n\n")[0] ?? "";
  const m = header.match(/दफा\s*:\s*([\d०-९]+)/);
  if (m) return toArabicDigits(m[1]);
  const label = chunk.section_label?.split(".")[0];
  return label ? toArabicDigits(label) : chunk.id;
}

/** Format every दफा under a matched परिच्छेद (chapter title search). */
export function formatChapterProvisionAnswer(chunks: MatchedChunk[]): string {
  const byDafa = new Map<string, MatchedChunk[]>();
  for (const chunk of chunks) {
    const key = sectionDafaKey(chunk);
    const group = byDafa.get(key) ?? [];
    group.push(chunk);
    byDafa.set(key, group);
  }

  const ordered = [...byDafa.entries()].sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );

  return ordered
    .map(([, group]) => formatHierarchicalSectionAnswer(group))
    .filter(Boolean)
    .join("\n\n---\n\n");
}
