/**
 * Pre-LLM homonym disambiguation: detect conflicting दफा in advocate context,
 * inject differentiation mandates, reorder sources, and drop non-primary when query is strong.
 */
import { sortChunksHierarchically } from "./hierarchical-section";
import {
  isPratiuttarAfterTamelDeadlineQuery,
  isPratiuttarDeadlineQuery,
} from "./legal-retrieval-boost";
import { filenameMatchesScope, type BookScope } from "./lawbooks";
import { toArabicDigits } from "./nepali-digits";
import type { MatchedChunk } from "./supabase";

type ChunkConflictRule = {
  id: string;
  scope: BookScope;
  dafas: [string, string];
  queryMatch: (q: string) => boolean;
  primaryDafa: (q: string, chunks: MatchedChunk[]) => string;
  mandate: (q: string, primary: string, other: string) => string;
};

export type ChunkConflictPinResult = {
  chunks: MatchedChunk[];
  mandate: string | null;
  appliedRuleId: string | null;
  primaryDafa: string | null;
  scope: BookScope | null;
};

function sectionRoot(chunk: MatchedChunk): string {
  const label = chunk.section_label?.split(".")[0]?.trim();
  return label ? toArabicDigits(label) : "";
}

function chunkMatchesScopeDafa(
  chunk: MatchedChunk,
  scope: BookScope,
  dafa: string
): boolean {
  return (
    filenameMatchesScope(chunk.filename, scope) && sectionRoot(chunk) === dafa
  );
}

function chunksContainDafa(
  chunks: MatchedChunk[],
  scope: BookScope,
  dafa: string
): boolean {
  return chunks.some((c) => chunkMatchesScopeDafa(c, scope, dafa));
}

function pairPresent(
  chunks: MatchedChunk[],
  scope: BookScope,
  [a, b]: [string, string]
): boolean {
  return (
    chunksContainDafa(chunks, scope, a) && chunksContainDafa(chunks, scope, b)
  );
}

function filterChunksToScopeDafas(
  chunks: MatchedChunk[],
  scope: BookScope,
  allowed: string[]
): MatchedChunk[] {
  const allowedSet = new Set(allowed);
  return chunks.filter((c) => {
    if (!filenameMatchesScope(c.filename, scope)) return true;
    return allowedSet.has(sectionRoot(c));
  });
}

function reorderPrimaryFirst(
  chunks: MatchedChunk[],
  scope: BookScope,
  primary: string
): MatchedChunk[] {
  const primaryChunks: MatchedChunk[] = [];
  const rest: MatchedChunk[] = [];
  for (const chunk of chunks) {
    if (chunkMatchesScopeDafa(chunk, scope, primary)) {
      primaryChunks.push(chunk);
    } else {
      rest.push(chunk);
    }
  }
  return [
    ...sortChunksHierarchically(primaryChunks),
    ...sortChunksHierarchically(rest),
  ];
}

function isArrestPermissionQuery(q: string): boolean {
  return (
    /पक्राउ|पक्राउ पुर्जी/i.test(q) &&
    /अनुमति|अनुसन्धान/i.test(q) &&
    !/फरार|हिरासत.*अदालत|चौबीस\s*घण्टा/i.test(q)
  );
}

function isFugitiveBenefitsQuery(q: string): boolean {
  return /फरार/i.test(q) && /सुविधा|धितोपत्र|धरौटी/i.test(q);
}

function isLongSentenceDetentionQuery(q: string): boolean {
  return (
    /कैद\s*सजाय|कैद सजाय/i.test(q) &&
    /पुर्पक्ष|थुनामा/i.test(q) &&
    !/फरार/i.test(q)
  );
}

function isTortHarmQuery(q: string): boolean {
  return (
    /कानूनबमोजिम\s*गर्न\s*नहुने|कानून बमोजिम गर्न नहुने/i.test(q) &&
    /हानि/i.test(q)
  );
}

function isPostTamelPratiuttarQuery(q: string): boolean {
  return (
    isPratiuttarAfterTamelDeadlineQuery(q) ||
    (isPratiuttarDeadlineQuery(q) &&
      /म्याद\s*तामेल|बाटोको\s*म्याद/i.test(q) &&
      !/अदालतले.*जारी|म्याद जारी/i.test(q))
  );
}

const CONFLICT_RULES: ChunkConflictRule[] = [
  {
    id: "tamel-vs-pratiuttar",
    scope: "civil-procedure",
    dafas: ["107", "119"],
    queryMatch: isPratiuttarAfterTamelDeadlineQuery,
    primaryDafa: () => "119",
    mandate: (_q, primary, other) =>
      `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(other)} vs ${toNepaliDafa(primary)}):
- दफा १०७: defines WHEN म्याद is deemed तामेल (service complete).
- दफा ११९: defines the deadline to FILE प्रतिउत्तरपत्र (21 days, बाटोको म्याद बाहेक) counted FROM the तामेल date.
- This question asks about the filing deadline AFTER तामेल → answer from दफा ११९ only in **सारांश**; cite 107 only if explaining when तामेल occurs.
- Do NOT conflate तामेल completion with the reply-filing deadline.`,
  },
  {
    id: "tamel-vs-pratiuttar-alt",
    scope: "civil-procedure",
    dafas: ["107", "101"],
    queryMatch: isPostTamelPratiuttarQuery,
    primaryDafa: (_q, chunks) =>
      chunksContainDafa(chunks, "civil-procedure", "119") ? "119" : "101",
    mandate: (_q, primary, other) =>
      primary === "119"
        ? `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(other)} / १०१ vs ११९):
- दफा १०७/१०१ govern court-issued notice and the period set in the order; दफा ११९ governs filing प्रतिउत्तरपत्र after म्याद तामेल भएको मिति.
- Answer the post-tamel filing deadline from दफा ११९ in **सारांश**.`
        : `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(other)} vs ${toNepaliDafa(primary)}):
- दफा १०७: when म्याद is deemed तामेल; दफा १०१: period the court sets when issuing notice.
- Lead **सारांश** with the provision that directly answers the question; do not blend adjacent म्याद तामेल rules.`,
  },
  {
    id: "arrest-permission",
    scope: "criminal-procedure",
    dafas: ["9", "14"],
    queryMatch: isArrestPermissionQuery,
    primaryDafa: () => "9",
    mandate: (_q, primary, other) =>
      `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(primary)} vs ${toNepaliDafa(other)}):
- दफा ९: who must authorize पक्राउ पुर्जी during investigation.
- दफा १४: custody duration / presenting arrestee to court within 24 hours.
- This question asks about permission to issue arrest warrant → answer from दफा ९ in **सारांश**; do not answer with हिरासत duration rules from दफा १४.`,
  },
  {
    id: "fugitive-vs-detention",
    scope: "criminal-procedure",
    dafas: ["65", "122"],
    queryMatch: isFugitiveBenefitsQuery,
    primaryDafa: () => "65",
    mandate: (_q, primary, other) =>
      `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(primary)} vs ${toNepaliDafa(other)}):
- दफा ६५: consequences for a fugitive accused (सरकारी सुविधा, धितोपत्र).
- दफा १२२: registration of प्रतिउत्तरपत्र.
- This question is about a fugitive accused → answer from दफा ६५ only in **सारांश**; do not cite प्रतिउत्तर registration from दफा १२२.`,
  },
  {
    id: "long-sentence-detention",
    scope: "criminal-procedure",
    dafas: ["67", "122"],
    queryMatch: isLongSentenceDetentionQuery,
    primaryDafa: () => "67",
    mandate: (_q, primary, other) =>
      `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(primary)} vs ${toNepaliDafa(other)}):
- दफा ६७: sending accused to थुनामा for पुर्पक्ष when sentence may exceed a threshold.
- दफा १२२: registration of प्रतिउत्तरपत्र.
- This question is about पुर्पक्ष/थुनामा for long sentences → answer from दफा ६७ in **सारांश**; ignore दफा १२२.`,
  },
  {
    id: "tort-vs-other",
    scope: "civil-code",
    dafas: ["8", "48"],
    queryMatch: isTortHarmQuery,
    primaryDafa: () => "8",
    mandate: (_q, primary, other) =>
      `TOPIC MANDATE — homonym disambiguation (दफा ${toNepaliDafa(primary)} vs ${toNepaliDafa(other)}):
- दफा ८: liability for harm from acts forbidden by law.
- दफा ४८: different civil-liability topic in the same book.
- This question asks about हानि from unlawful acts → answer from दफा ८ in **सारांश**; do not substitute दफा ४८.`,
  },
];

function toNepaliDafa(arabic: string): string {
  const map: Record<string, string> = {
    "0": "०",
    "1": "१",
    "2": "२",
    "3": "३",
    "4": "४",
    "5": "५",
    "6": "६",
    "7": "७",
    "8": "८",
    "9": "९",
  };
  return arabic.replace(/\d/g, (d) => map[d] ?? d);
}

function otherDafaInPair(rule: ChunkConflictRule, primary: string): string {
  return rule.dafas[0] === primary ? rule.dafas[1] : rule.dafas[0];
}

export function applyChunkConflictPinning(
  chunks: MatchedChunk[],
  query: string,
  originalQuestion?: string
): ChunkConflictPinResult {
  const combined = `${query} ${originalQuestion ?? ""}`.trim();

  for (const rule of CONFLICT_RULES) {
    if (!pairPresent(chunks, rule.scope, rule.dafas)) continue;

    const primary = rule.primaryDafa(combined, chunks);
    const other = otherDafaInPair(rule, primary);
    const mandate = rule.mandate(combined, primary, other);
    const strong = rule.queryMatch(combined);

    let next = chunks;
    if (strong) {
      const before = chunks.length;
      const filtered = filterChunksToScopeDafas(chunks, rule.scope, [primary]);
      next = filtered.length > 0 ? filtered : chunks;
      const dropped = before - next.length;
      console.log(
        "[HandyLaw chunk conflict pin]",
        JSON.stringify({
          ruleId: rule.id,
          strong: true,
          primary,
          dropped,
          kept: next
            .filter((c) => filenameMatchesScope(c.filename, rule.scope))
            .map((c) => sectionRoot(c)),
        })
      );
    } else {
      next = reorderPrimaryFirst(chunks, rule.scope, primary);
      console.log(
        "[HandyLaw chunk conflict pin]",
        JSON.stringify({
          ruleId: rule.id,
          strong: false,
          primary,
          reordered: true,
        })
      );
    }

    return {
      chunks: next,
      mandate,
      appliedRuleId: rule.id,
      primaryDafa: primary,
      scope: rule.scope,
    };
  }

  return {
    chunks,
    mandate: null,
    appliedRuleId: null,
    primaryDafa: null,
    scope: null,
  };
}
