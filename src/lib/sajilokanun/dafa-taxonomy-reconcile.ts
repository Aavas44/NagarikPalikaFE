import {
  ACT_ENGLISH_NAMES,
  loadDafaTaxonomyForAct,
  resolveDafaNumbersFromMatchingNames,
  resolveNormalizeActFromEnglishName,
  resolveNormalizeActsForScope,
  type DafaTaxonomyEntry,
  type NormalizeActId,
} from "./dafa-name-taxonomy";
import { scoreProvisionTitleMatch } from "./provision-title-search";
import { toArabicDigits } from "./nepali-digits";
import type { BookScope } from "./lawbooks";

export type MetadataForReconcile = {
  act?: string;
  matchingDafaNames?: string[];
  exactDafaGuess?: number[];
};

const DEFAULT_THRESHOLD = 0.45;
const NUMBER_ANCHOR_MIN_SCORE = 0.3;
/** Number-only match must also have this title score to block cross-act override. */
const NUMBER_ANCHOR_TITLE_FLOOR = 0.45;

export type ReconcileItemResult = {
  original: string;
  reconciled: string;
  matched: boolean;
  score: number;
  sectionRoot: number | null;
  /** Act that owns the reconciled taxonomy line, when matched. */
  actId: NormalizeActId | null;
};

export type ReconcileResult = {
  matchingDafaNames: string[];
  exactDafaGuess: number[];
  items: ReconcileItemResult[];
  confidence: number;
  /** Inferred governing act from matched taxonomy entries. */
  inferredAct?: string;
};

function reconcileThreshold(): number {
  const configured = Number(process.env.QUERY_NORMALIZE_RECONCILE_THRESHOLD);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_THRESHOLD;
}

function parseLlmDafaLine(line: string): { sectionRoot: number | null; title: string } {
  const trimmed = line.trim().replace(/^दफा\s+/u, "");
  const match = trimmed.match(/^([\d०-९]+[क-ह]?)\.\s*(.+)$/u);
  if (!match) {
    return { sectionRoot: null, title: trimmed };
  }
  const digits = match[1].replace(/[क-ह]$/u, "");
  const n = Number(toArabicDigits(digits));
  return {
    sectionRoot: Number.isFinite(n) && n > 0 ? n : null,
    title: match[2].trim(),
  };
}

type TaggedEntry = DafaTaxonomyEntry & { actId: NormalizeActId };

function collectTaggedEntries(acts: NormalizeActId[]): TaggedEntry[] {
  const entries: TaggedEntry[] = [];
  for (const actId of acts) {
    const tax = loadDafaTaxonomyForAct(actId);
    if (tax?.entries.length) {
      for (const entry of tax.entries) {
        entries.push({ ...entry, actId });
      }
    }
  }
  return entries;
}

function scoreEntryMatch(
  entry: DafaTaxonomyEntry,
  proposedTitle: string,
  proposedRoot: number | null
): number {
  const titleScore = Math.max(
    scoreProvisionTitleMatch(proposedTitle, entry.title),
    scoreProvisionTitleMatch(proposedTitle, entry.displayLine)
  );

  if (proposedRoot != null && entry.sectionRoot === proposedRoot) {
    return Math.max(titleScore, titleScore >= NUMBER_ANCHOR_TITLE_FLOOR ? 0.72 : titleScore);
  }

  return titleScore;
}

function findBestEntry(
  entries: TaggedEntry[],
  proposedTitle: string,
  proposedRoot: number | null
): { entry: TaggedEntry; score: number; titleScore: number } | null {
  if (proposedRoot != null) {
    const byRoot = entries.filter((entry) => entry.sectionRoot === proposedRoot);
    if (byRoot.length > 0) {
      let bestByRoot: { entry: TaggedEntry; score: number; titleScore: number } | null =
        null;
      for (const entry of byRoot) {
        const titleScore = Math.max(
          scoreProvisionTitleMatch(proposedTitle, entry.title),
          scoreProvisionTitleMatch(proposedTitle, entry.displayLine)
        );
        if (titleScore < NUMBER_ANCHOR_MIN_SCORE) {
          const shortAnchor =
            proposedTitle.length > 0 && proposedTitle.length <= 12;
          if (!shortAnchor) continue;
        }
        const score = Math.max(titleScore, 0.75);
        if (!bestByRoot || score > bestByRoot.score) {
          bestByRoot = { entry, score, titleScore };
        }
      }
      if (bestByRoot) return bestByRoot;
    }
  }

  let best: { entry: TaggedEntry; score: number; titleScore: number } | null = null;

  for (const entry of entries) {
    const titleScore = Math.max(
      scoreProvisionTitleMatch(proposedTitle, entry.title),
      scoreProvisionTitleMatch(proposedTitle, entry.displayLine)
    );
    const score = scoreEntryMatch(entry, proposedTitle, proposedRoot);
    if (!best || score > best.score) {
      best = { entry, score, titleScore };
    }
  }

  return best;
}

function resolveSearchActs(
  act: string | undefined,
  bookScope?: BookScope
): NormalizeActId[] {
  if (bookScope && bookScope !== "auto") {
    return resolveNormalizeActsForScope(bookScope);
  }
  if (act?.trim()) {
    const fromAct = resolveNormalizeActFromEnglishName(act);
    if (fromAct) return [fromAct];
  }
  return resolveNormalizeActsForScope("auto");
}

/** Acts eligible for cross-statute fallback when book filter is open. */
function resolveFallbackActs(
  primaryActs: NormalizeActId[],
  bookScope?: BookScope
): NormalizeActId[] {
  if (bookScope && bookScope !== "auto") {
    return primaryActs;
  }
  return resolveNormalizeActsForScope("auto");
}

function reconcileOneName(
  llmName: string,
  primaryActs: NormalizeActId[],
  fallbackActs: NormalizeActId[],
  threshold: number
): ReconcileItemResult {
  const { sectionRoot, title } = parseLlmDafaLine(llmName);
  const primaryEntries = collectTaggedEntries(primaryActs);
  const fallbackEntries = collectTaggedEntries(fallbackActs);
  const crossActEnabled = fallbackActs.length > primaryActs.length;

  // When LLM proposes a दफा number, match title among that number across acts first
  // (avoids e.g. civil दफा ७१ winning over criminal दफा १७५ for polygamy queries).
  if (sectionRoot != null) {
    const rootPool = (
      crossActEnabled ? fallbackEntries : primaryEntries
    ).filter((entry) => entry.sectionRoot === sectionRoot);
    if (rootPool.length > 0) {
      const rootBest = findBestEntry(rootPool, title, null);
      if (
        rootBest &&
        (rootBest.score >= threshold ||
          rootBest.titleScore >= NUMBER_ANCHOR_MIN_SCORE)
      ) {
        return {
          original: llmName,
          reconciled: rootBest.entry.displayLine,
          matched: true,
          score: rootBest.score,
          sectionRoot: rootBest.entry.sectionRoot,
          actId: rootBest.entry.actId,
        };
      }
    }
  }

  const primaryBest = findBestEntry(primaryEntries, title, sectionRoot);
  const fallbackBest = findBestEntry(fallbackEntries, title, sectionRoot);

  const primaryUsedNumberAnchor = Boolean(
    primaryBest &&
      sectionRoot != null &&
      primaryBest.entry.sectionRoot === sectionRoot &&
      primaryBest.titleScore >= NUMBER_ANCHOR_TITLE_FLOOR
  );

  let best = primaryBest;
  if (
    fallbackBest &&
    (!best || fallbackBest.score > best.score) &&
    !primaryUsedNumberAnchor
  ) {
    best = fallbackBest;
  }

  const numberAnchored =
    sectionRoot != null &&
    best != null &&
    best.entry.sectionRoot === sectionRoot &&
    best.score >= NUMBER_ANCHOR_MIN_SCORE;

  const matched = Boolean(best && (best.score >= threshold || numberAnchored));

  return {
    original: llmName,
    reconciled: matched && best ? best.entry.displayLine : llmName,
    matched,
    score: best?.score ?? 0,
    sectionRoot: matched && best ? best.entry.sectionRoot : sectionRoot,
    actId: matched && best ? best.entry.actId : null,
  };
}

function inferActFromItems(
  items: ReconcileItemResult[],
  llmAct: string | undefined,
  bookScope: BookScope | undefined,
  allowedActs: NormalizeActId[]
): string | undefined {
  const matched = items.filter((item) => item.matched && item.actId);
  if (matched.length === 0) {
    return llmAct?.trim() || undefined;
  }

  const counts = new Map<NormalizeActId, number>();
  for (const item of matched) {
    if (!item.actId || !allowedActs.includes(item.actId)) continue;
    counts.set(item.actId, (counts.get(item.actId) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return llmAct?.trim() || undefined;
  }

  let winner: NormalizeActId | null = null;
  let topCount = 0;
  for (const [actId, count] of counts) {
    if (count > topCount) {
      winner = actId;
      topCount = count;
    }
  }

  if (!winner) {
    return llmAct?.trim() || undefined;
  }

  const llmActId = llmAct ? resolveNormalizeActFromEnglishName(llmAct) : null;
  if (
    bookScope &&
    bookScope !== "auto" &&
    llmActId &&
    allowedActs.includes(llmActId)
  ) {
    return ACT_ENGLISH_NAMES[llmActId];
  }

  return ACT_ENGLISH_NAMES[winner];
}

/** True when taxonomy for actId contains this root दफा number. */
function actOwnsDafaNumber(actId: NormalizeActId, sectionRoot: number): boolean {
  const tax = loadDafaTaxonomyForAct(actId);
  return Boolean(tax?.entries.some((entry) => entry.sectionRoot === sectionRoot));
}

/**
 * Keep only exact_dafa_guess numbers that:
 * 1) come from reconciled matching_dafa_names, and
 * 2) exist under the governing/inferred act.
 * Drop LLM orphan numbers and wrong-act homonyms.
 */
function validateExactDafasAgainstAct(
  items: ReconcileItemResult[],
  llmExact: number[] | undefined,
  inferredAct: string | undefined
): number[] {
  const actId = inferredAct
    ? resolveNormalizeActFromEnglishName(inferredAct)
    : null;

  const fromMatched = items
    .filter((item) => item.matched && item.sectionRoot != null && item.sectionRoot > 0)
    .filter((item) => !actId || !item.actId || item.actId === actId)
    .map((item) => item.sectionRoot!)
    .filter((n) => !actId || actOwnsDafaNumber(actId, n));

  if (fromMatched.length > 0) {
    return [...new Set(fromMatched)].slice(0, 3);
  }

  // No matching names reconciled — only keep LLM numbers that exist on the act.
  if (!llmExact?.length || !actId) {
    return [];
  }

  return llmExact
    .filter((n) => Number.isFinite(n) && n > 0 && actOwnsDafaNumber(actId, n))
    .slice(0, 3);
}

/**
 * Score how well an LLM proposed title matches the claimed act's entry for that number.
 * Low score ⇒ likely wrong-act homonym (e.g. Devani 175 vs Aparadh 175).
 */
function scoreTitleVsActEntry(
  actId: NormalizeActId,
  sectionRoot: number,
  proposedTitle: string
): number {
  const tax = loadDafaTaxonomyForAct(actId);
  const entry = tax?.entries.find((e) => e.sectionRoot === sectionRoot);
  if (!entry) return 0;
  return Math.max(
    scoreProvisionTitleMatch(proposedTitle, entry.title),
    scoreProvisionTitleMatch(proposedTitle, entry.displayLine)
  );
}

/**
 * Map LLM-proposed matching_dafa_names to verbatim indexed taxonomy displayLine strings.
 */
export function reconcileMatchingDafaNames(
  llmNames: string[],
  act?: string,
  bookScope?: BookScope
): ReconcileResult {
  if (llmNames.length === 0) {
    return {
      matchingDafaNames: [],
      exactDafaGuess: [],
      items: [],
      confidence: 0,
    };
  }

  const threshold = reconcileThreshold();
  const primaryActs = resolveSearchActs(act, bookScope);
  const fallbackActs = resolveFallbackActs(primaryActs, bookScope);

  const items = llmNames.slice(0, 3).map((name) =>
    reconcileOneName(name, primaryActs, fallbackActs, threshold)
  );

  // If LLM claimed an act but title-for-number scores poorly there while another
  // act matches strongly, prefer the matched act entry (already done in reconcileOneName).
  // Mark mismatches for logging when claimed-act title score is weak.
  const llmActId = act ? resolveNormalizeActFromEnglishName(act) : null;
  for (const item of items) {
    if (!item.matched || !item.sectionRoot || !llmActId) continue;
    const { title } = parseLlmDafaLine(item.original);
    const claimedScore = scoreTitleVsActEntry(llmActId, item.sectionRoot, title);
    if (
      item.actId &&
      item.actId !== llmActId &&
      claimedScore < NUMBER_ANCHOR_TITLE_FLOOR &&
      item.score >= threshold
    ) {
      // Cross-act correction retained; claimed act rejected for this line.
      continue;
    }
  }

  const matchingDafaNames = items.map((item) => item.reconciled);
  const inferredAct = inferActFromItems(items, act, bookScope, fallbackActs);

  const fromReconciled = resolveDafaNumbersFromMatchingNames(
    matchingDafaNames,
    inferredAct
  );
  const fromRoots = items
    .filter((item) => item.matched)
    .map((item) => item.sectionRoot)
    .filter((n): n is number => n != null && n > 0);
  const exactDafaGuess = [...new Set([...fromReconciled, ...fromRoots])].slice(0, 3);

  const matchedScores = items.filter((item) => item.matched).map((item) => item.score);
  const confidence =
    matchedScores.length > 0 ? Math.min(...matchedScores) : 0;

  return {
    matchingDafaNames,
    exactDafaGuess,
    items,
    confidence,
    inferredAct,
  };
}

/** Apply taxonomy reconciliation to normalize metadata (slim and legacy). */
export function reconcileMetadataHint<T extends MetadataForReconcile>(
  metadata: T,
  bookScope?: BookScope
): T {
  const reconciled = { ...metadata };

  if (metadata.matchingDafaNames?.length) {
    const result = reconcileMatchingDafaNames(
      metadata.matchingDafaNames,
      metadata.act,
      bookScope
    );

    reconciled.matchingDafaNames = result.matchingDafaNames;

    if (result.inferredAct) {
      reconciled.act = result.inferredAct;
    }

    const validated = validateExactDafasAgainstAct(
      result.items,
      metadata.exactDafaGuess,
      result.inferredAct ?? metadata.act
    );
    reconciled.exactDafaGuess =
      validated.length > 0 ? validated : result.exactDafaGuess;

    const actChanged =
      metadata.act &&
      result.inferredAct &&
      metadata.act.trim() !== result.inferredAct.trim();

    const droppedNumbers =
      metadata.exactDafaGuess?.filter(
        (n) => !(reconciled.exactDafaGuess ?? []).includes(n)
      ) ?? [];

    const unmatched = result.items.filter((item) => !item.matched);
    if (unmatched.length > 0 || actChanged || droppedNumbers.length > 0) {
      console.warn(
        "[HandyLaw taxonomy reconcile]",
        JSON.stringify({
          act: metadata.act ?? null,
          inferredAct: result.inferredAct ?? null,
          actChanged: actChanged || undefined,
          droppedExactDafaGuess:
            droppedNumbers.length > 0 ? droppedNumbers : undefined,
          bookScope: bookScope ?? "auto",
          unmatched: unmatched.map((item) => ({
            original: item.original,
            score: item.score,
          })),
          reconciled: result.matchingDafaNames,
          exactDafaGuess: reconciled.exactDafaGuess,
          confidence: result.confidence,
        })
      );
    } else {
      console.log(
        "[HandyLaw taxonomy reconcile]",
        JSON.stringify({
          act: result.inferredAct ?? metadata.act ?? null,
          bookScope: bookScope ?? "auto",
          reconciled: result.matchingDafaNames,
          exactDafaGuess: reconciled.exactDafaGuess,
          confidence: result.confidence,
        })
      );
    }

    return reconciled;
  }

  // Names missing: still validate LLM numbers against claimed act when possible.
  if (metadata.exactDafaGuess?.length && metadata.act) {
    const actId = resolveNormalizeActFromEnglishName(metadata.act);
    if (actId) {
      const kept = metadata.exactDafaGuess.filter((n) =>
        actOwnsDafaNumber(actId, n)
      );
      if (kept.length !== metadata.exactDafaGuess.length) {
        console.warn(
          "[HandyLaw taxonomy reconcile]",
          JSON.stringify({
            act: metadata.act,
            droppedExactDafaGuess: metadata.exactDafaGuess.filter(
              (n) => !kept.includes(n)
            ),
            exactDafaGuess: kept,
            reason: "number not in claimed act taxonomy",
          })
        );
      }
      reconciled.exactDafaGuess = kept;
    }
  }

  return reconciled;
}
