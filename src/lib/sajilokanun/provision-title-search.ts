const TITLE_STOP_WORDS = new Set([
  "गरेको",
  "गर्न",
  "हुने",
  "हुन",
  "काम",
  "कसूर",
  "लागि",
  "पाउने",
  "वा",
  "र",
  "को",
  "का",
  "ले",
  "मा",
  "छ",
  "हो",
]);

/** Strip punctuation and collapse whitespace for title comparison. */
export function normalizeProvisionTitle(text: string): string {
  return text
    .replace(/[ः:।]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chapter field value → display name after em dash. */
export function extractChapterDisplayName(chapter: string): string {
  const split = chapter.split(/[—–\-]\s*/);
  if (split.length > 1) return split.slice(1).join(" ").trim();
  return chapter.replace(/^परिच्छेद\s*[\d०-९]+\s*/u, "").trim();
}

function titleTokens(text: string): string[] {
  return normalizeProvisionTitle(text)
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !TITLE_STOP_WORDS.has(word));
}

function prefixOverlapScore(query: string, target: string): number {
  const q = normalizeProvisionTitle(query);
  const t = normalizeProvisionTitle(target);
  if (!q || !t) return 0;
  if (t.includes(q) || q.includes(t)) {
    return 0.75 + (Math.min(q.length, t.length) / Math.max(q.length, t.length)) * 0.25;
  }

  const max = Math.min(q.length, t.length);
  let shared = 0;
  while (shared < max && q[shared] === t[shared]) shared += 1;
  if (shared >= Math.min(8, max)) {
    return 0.55 + (shared / max) * 0.35;
  }
  return 0;
}

/** Score how well a user query matches a stored दफा / परिच्छेद title (0–1). */
export function scoreProvisionTitleMatch(query: string, title: string): number {
  const prefix = prefixOverlapScore(query, title);
  const qTokens = titleTokens(query);
  const tTokens = titleTokens(title);
  if (qTokens.length === 0) return prefix;

  let matched = 0;
  for (const word of qTokens) {
    if (tTokens.some((target) => target.includes(word) || word.includes(target))) {
      matched += 1;
    }
  }
  const tokenScore = matched / qTokens.length;
  return Math.max(prefix, tokenScore * 0.92 + (qTokens.length >= 4 ? 0.05 : 0));
}

/** Longest meaningful token for DB ilike anchor (avoids full-table scan). */
export function pickTitleSearchAnchor(query: string): string | null {
  const words = normalizeProvisionTitle(query)
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !TITLE_STOP_WORDS.has(word));

  if (words.length === 0) {
    const fallback = normalizeProvisionTitle(query).slice(0, 12);
    return fallback.length >= 3 ? fallback : null;
  }

  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** Short user phrases → canonical दफा title for metadata search. */
export function expandProvisionTitleQuery(query: string): string {
  const trimmed = query.trim();
  if (/^बाल\s*विवाह$/u.test(trimmed) || /^बालविवाह$/iu.test(trimmed)) {
    return "बाल विवाह गर्न नहुने";
  }
  return trimmed;
}

/** True when the query looks like a दफा / परिच्छेद name lookup (not a दफा number). */
export function isProvisionTitleQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/^(?:dafa|sec)_[\w\u0900-\u097F]+$/i.test(trimmed)) return false;
  if (/(?:^|(?<![a-zA-Z\u0900-\u097F]))(?:दफा|dafa|daafa|dapha|section|sec\.?)\s*[\d०-९]+/i.test(trimmed)) {
    return false;
  }

  const devanagari = (trimmed.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devanagari < 6) return false;

  const words = trimmed.split(/[\s,।.?!;:ः]+/).filter((word) => word.length > 1);
  return words.length >= 2 || devanagari >= 10;
}

export const MIN_PROVISION_TITLE_SCORE = 0.52;

/** Tokens that suggest a phrase is a statutory दफा / परिच्छेद title, not a question filler. */
const LEGAL_TITLE_SIGNALS = new Set([
  "बिगो",
  "जायजात",
  "मिलापत्र",
  "मेलमिलाप",
  "जरिबाना",
  "कार्यविधि",
  "हदम्याद",
  "म्याद",
  "तामेल",
  "फिराद",
  "प्रतिउत्तर",
  "क्षतिपूर्ति",
  "लिलाम",
  "अंशबण्डा",
  "फैसला",
  "कार्यान्वयन",
  "वारिसनामा",
  "धरौटी",
  "खारेज",
  "डिसमिस",
  "पुनरावेदन",
  "मुद्दा",
  "मुलतवी",
  "दरपीठ",
  "अग्रिम",
  "सूचना",
  "धुल्याउ",
  "मिसिल",
  "जफत",
  "लिखत",
]);

function phraseHasTitleSignal(phrase: string): boolean {
  const tokens = titleTokens(phrase);
  if (tokens.length === 0) return false;
  return tokens.some(
    (t) =>
      LEGAL_TITLE_SIGNALS.has(t) ||
      /कार्यविधि|व्यवस्था|सम्बन्धी|सम्बन्धि$/u.test(t)
  );
}

function rankTitleCandidate(phrase: string): number {
  const tokens = titleTokens(phrase);
  const signalHits = tokens.filter(
    (t) =>
      LEGAL_TITLE_SIGNALS.has(t) ||
      /कार्यविधि|व्यवस्था$/u.test(t)
  ).length;
  return (
    phrase.length * 0.02 +
    signalHits * 6 +
    (phrase.includes("कार्यविधि") ? 4 : 0) +
    (tokens.length >= 3 ? 2 : 0)
  );
}

function dedupeTitleCandidates(candidates: string[]): string[] {
  const seen = new Set<string>();
  const ranked = [...candidates].sort(
    (a, b) => rankTitleCandidate(b) - rankTitleCandidate(a)
  );
  const out: string[] = [];
  for (const raw of ranked) {
    const phrase = normalizeProvisionTitle(raw);
    if (phrase.length < 4) continue;
    const key = phrase.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

/**
 * Pull statutory title phrases from a long question — quoted text, n-grams with legal signals.
 * Example: "…'बिगो भराउने' कार्यविधि…" → ["बिगो भराउने कार्यविधि", "बिगो भराउने", …]
 */
export function extractProvisionTitleCandidates(query: string): string[] {
  const candidates: string[] = [];

  const quotePatterns = [
    /'([^']+)'/gu,
    /"([^"]+)"/gu,
    /'([^']+)'/gu,
    /「([^」]+)」/gu,
    /『([^』]+)』/gu,
  ];
  for (const re of quotePatterns) {
    for (const m of query.matchAll(re)) {
      const inner = normalizeProvisionTitle(m[1] ?? "");
      if (inner.length >= 3) candidates.push(inner);
    }
  }

  const normalized = normalizeProvisionTitle(
    query.replace(/[''"「『」』]/gu, " ")
  );
  const words = normalized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);

  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? "";
    if (/कार्यविधि|व्यवस्था$/u.test(w) && i > 0) {
      const two = `${words[i - 1]} ${w}`;
      const three = i > 1 ? `${words[i - 2]} ${two}` : two;
      candidates.push(two, three);
    }
  }

  for (let n = 5; n >= 2; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (phraseHasTitleSignal(phrase)) candidates.push(phrase);
    }
  }

  if (/जायजात/u.test(normalized)) {
    candidates.push("जायजात हुने सम्पत्ति");
  }
  if (/धुल्याउ/u.test(normalized) && /मिसिल/u.test(normalized)) {
    candidates.push("लिखत धुल्याउनु पर्ने");
  }
  if (/बिगो/u.test(normalized) && /भराउने|बुझाउन/u.test(normalized)) {
    candidates.push("बिगो भराउने कार्यविधि");
  }

  return dedupeTitleCandidates(candidates);
}

/** Top phrases for title DB lookup — canonical statutory titles always included. */
export function topProvisionTitleCandidates(
  query: string,
  hints: string[] = [],
  limit = 5
): string[] {
  const canonical: string[] = [];
  const normalized = normalizeProvisionTitle(query);
  if (/जायजात/u.test(normalized)) {
    canonical.push("जायजात हुने सम्पत्ति");
  }
  if (/धुल्याउ/u.test(normalized) && /मिसिल/u.test(normalized)) {
    canonical.push("लिखत धुल्याउनु पर्ने");
  }
  if (/बिगो/u.test(normalized) && /भराउने|बुझाउन/u.test(normalized)) {
    canonical.push("बिगो भराउने कार्यविधि");
  }

  const merged = mergeProvisionTitleSearchCandidates(query, hints);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of [...canonical, ...merged]) {
    const key = normalizeProvisionTitle(phrase);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
    if (out.length >= limit) break;
  }
  return out;
}

/** Merge query-extracted phrases with LLM / heuristic title hints. */
export function mergeProvisionTitleSearchCandidates(
  query: string,
  hints: string[] = []
): string[] {
  const merged = [...extractProvisionTitleCandidates(query)];
  for (const hint of hints) {
    const trimmed = hint.trim();
    if (!trimmed) continue;
    merged.push(expandProvisionTitleQuery(trimmed));
    merged.push(...extractProvisionTitleCandidates(trimmed));
  }
  if (isProvisionTitleQuery(query)) {
    merged.push(expandProvisionTitleQuery(query));
  }
  return dedupeTitleCandidates(merged);
}

/** Anchors for DB ilike — prefer multi-word signal phrases, not a single vague token. */
export function pickTitleSearchAnchors(candidates: string[]): string[] {
  const anchors = new Set<string>();

  function addPhraseAnchors(expanded: string): void {
    const normalized = normalizeProvisionTitle(expanded);

    const phraseWords = normalized
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 1);
    if (phraseWords.length >= 2 && phraseWords.length <= 6) {
      anchors.add(phraseWords.join(" "));
      if (phraseWords.length >= 3) {
        anchors.add(phraseWords.slice(0, 3).join(" "));
      }
    }

    const tokens = titleTokens(expanded);
    if (tokens.length >= 2) {
      anchors.add(tokens.slice(0, 2).join(" "));
      if (tokens.length >= 3) {
        anchors.add(tokens.slice(0, 3).join(" "));
      }
    }
    const single = pickTitleSearchAnchor(expanded);
    if (single) anchors.add(single);
  }

  for (const candidate of candidates.slice(0, 6)) {
    addPhraseAnchors(expandProvisionTitleQuery(candidate));
  }

  const ordered = [...anchors].sort((a, b) => b.length - a.length);
  const primary = candidates[0]
    ? normalizeProvisionTitle(expandProvisionTitleQuery(candidates[0]))
        .split(/\s+/)
        .filter((w) => w.length > 1)
        .join(" ")
    : "";
  if (primary && anchors.has(primary)) {
    return [primary, ...ordered.filter((a) => a !== primary)].slice(0, 6);
  }
  return ordered.slice(0, 6);
}
