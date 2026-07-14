import {
  filenameMatchesScope,
  LAW_BOOKS,
  normalizeActToBookScope,
  type BookScope,
} from "./lawbooks";
import type { MatchedChunk } from "./supabase";
import type { QueryAnalysis, SectionHint } from "./query-analysis";
import { questionTopicSectionLookups } from "./question-topic-pins";
import { scoreProvisionTitleMatch } from "./provision-title-search";

/** Max unique दफा sections in advocate answers (provisions + UI sources). */
export const ADVOCATE_DAFA_MAX = Number(process.env.ADVOCATE_DAFA_MAX ?? 3);

/** Extra search strings when the query matches known legal topic patterns. */
export function supplementalRetrievalQueries(
  query: string,
  _bookScope: BookScope | string[] = "auto"
): string[] {
  const extras: string[] = [];
  const q = query;

  if (
    /प्रतिउत्तर|प्रतिवाद|prat[iu]?tuttar|pratibadi|prativadi|likhit.*prat|written reply|counter.?statement|counter.?claim/i.test(
      q
    )
  ) {
    extras.push("एक्काइस दिन प्रतिउत्तरपत्र म्याद");
    extras.push("म्याद तामेल प्रतिबादी भरपाई");
    if (isPratiuttarAfterTamelDeadlineQuery(q)) {
      extras.push("दफा ११९ प्रतिउत्तरपत्र पेश");
      extras.push("म्याद तामेल भएको मितिले बाटोको म्याद");
    } else {
      extras.push("दफा १०१ बाटोको म्याद");
    }
    if (isPratiuttarDeadlineQuery(q)) {
      extras.push("गुज्रेको म्याद थमाउन पन्ध्र दिन");
      extras.push("दफा २२५ काबु बाहिरको परिस्थिति");
      extras.push("समय माग गर्न पन्ध्र दिन प्रतिउत्तरपत्र");
      extras.push("बाटाको म्याद हिसाब");
    }
  }

  if (/म्याद\s*थप|extension of time|extend.*deadline/i.test(q)) {
    extras.push("म्याद थप पन्ध्र दिन");
    extras.push("काबु बाहिरको परिस्थिति म्याद");
  }

  if (/सुत्केरी|किरिया|अपहरण|प्राकृतिक प्रकोप/i.test(q)) {
    extras.push("सुत्केरी म्याद थप प्रतिउत्तर");
  }

  if (/साक्ष|witness|evidence/i.test(q)) {
    extras.push("साक्षी साक्ष प्रमाण");
  }

  if (/अनुसन्धान|investigation/i.test(q)) {
    extras.push("अनुसन्धान अधिकारी");
  }

  if (/बालविवाह|बाल विवाह|child marriage/i.test(q)) {
    extras.push("बाल विवाह गर्न नहुने");
    extras.push("दफा १७३ बाल विवाह");
  }

  if (/विवाह.*उमेर|उमेर.*विवाह|विवाह हुन सक्ने|विवाह गर्नका/i.test(q)) {
    extras.push("विवाह हुन सक्ने बीस वर्ष उमेर");
    extras.push("दफा ७० विवाह");
  }

  if (/करार.*मान्य|मान्य.*करार|करार.*सर्त|आवश्यक सर्त|valid contract/i.test(q)) {
    extras.push("कानून बमोजिम कार्यान्वयन हुने करार");
    extras.push("बदर हुने करार दफा ५१७");
    extras.push("करार भएको मानिने प्रस्ताव स्वीकृति");
  }

  if (/हत्या|murder|homicide|ज्यान मार/i.test(q)) {
    extras.push("ज्यान मार्ने नियतले कुनै काम गर्न नहुने");
    extras.push("दफा १७७ ज्यान मारेको सजाय");
  }

  if (/चोरी|theft|steal/i.test(q)) {
    extras.push("चोरी गर्न नहुने");
    extras.push("चोरी गरेमा हुने सजाय");
    extras.push("दफा २४१ २४२");
  }

  if (/false.*complaint|false.*criminal.*report|झुठ्ठा.*उजुर/i.test(q)) {
    extras.push("झुठ्ठा उजुरी दिन नहुने");
    extras.push("दफा ९८ क्षति पुर्याउने");
  }

  if (
    /हिरासत|custody/i.test(q) &&
    /अदालत|court|पेश|present|चौबीस|२४ घण्टा|24 hour/i.test(q)
  ) {
    extras.push("चौबीस घण्टा अनुसन्धान हिरासत अदालत");
    extras.push("दफा १४ हिरासतमा राख्न सकिने अवधि");
  }

  if (isMilapatraCourtFeeQuery(q)) {
    extras.push("मुद्दा मिलापत्र अदालती शुल्क फिर्ता");
    extras.push("दफा ८२ पच्चीस प्रतिशत आधा शुल्क");
    extras.push("अदालती शुल्क धरौटी फिर्ता लिने अवधि");
  }

  return [...new Set(extras)];
}

export type SectionLookup = { section: string; scope: BookScope };

/** Act-specific दफा to pin for topic keywords (supports multiple books). */
export function supplementalSectionLookups(query: string): SectionLookup[] {
  const out: SectionLookup[] = [];
  if (/बालविवाह|बाल विवाह|child marriage/i.test(query)) {
    out.push({ section: "173", scope: "criminal-code" });
  }
  if (/विवाह.*उमेर|उमेर.*विवाह|विवाह हुन सक्ने|विवाह गर्नका/i.test(query)) {
    out.push({ section: "70", scope: "civil-code" });
  }
  if (/हत्या|murder|homicide|ज्यान मार/i.test(query)) {
    out.push({ section: "177", scope: "criminal-code" });
  }
  if (/चोरी|theft|steal/i.test(query)) {
    out.push({ section: "241", scope: "criminal-code" });
    out.push({ section: "242", scope: "criminal-code" });
  }
  if (/false.*complaint|false.*criminal.*report|झुठ्ठा.*उजुर/i.test(query)) {
    out.push({ section: "98", scope: "criminal-code" });
  }
  if (
    /हिरासत|custody/i.test(query) &&
    /अदालत|court|पेश|present|चौबीस|२४ घण्टा|24 hour/i.test(query)
  ) {
    out.push({ section: "14", scope: "criminal-procedure" });
  }
  if (
    /प्रतिउत्तर|प्रतिवाद|prat[iu]?tuttar|pratibadi|prativadi|likhit.*prat|written reply|counter.?statement/i.test(
      query
    )
  ) {
    if (isPratiuttarAfterTamelDeadlineQuery(query)) {
      out.push({ section: "119", scope: "civil-procedure" });
    } else {
      out.push({ section: "101", scope: "civil-procedure" });
    }
  }
  if (isPratiuttarDeadlineQuery(query)) {
    if (isPratiuttarAfterTamelDeadlineQuery(query)) {
      out.push(
        { section: "119", scope: "civil-procedure" },
        { section: "163", scope: "civil-procedure" },
        { section: "223", scope: "civil-procedure" },
        { section: "225", scope: "civil-procedure" },
        { section: "227", scope: "civil-procedure" },
        { section: "228", scope: "civil-procedure" }
      );
    } else {
      out.push(
        { section: "100", scope: "civil-procedure" },
        { section: "163", scope: "civil-procedure" },
        { section: "223", scope: "civil-procedure" },
        { section: "225", scope: "civil-procedure" },
        { section: "227", scope: "civil-procedure" },
        { section: "228", scope: "civil-procedure" }
      );
    }
  }
  if (isMilapatraCourtFeeQuery(query)) {
    out.push(
      { section: "82", scope: "civil-procedure" },
      { section: "248", scope: "civil-procedure" }
    );
  }
  if (isKharejCourtFeeRefundQuery(query)) {
    out.push({ section: "82", scope: "civil-procedure" });
  }
  for (const { section, scope } of questionTopicSectionLookups(query)) {
    if (!out.some((x) => x.section === section && x.scope === scope)) {
      out.push({ section, scope });
    }
  }
  return out;
}

/** Section numbers to boost when topic keywords match (act-specific lookup). */
export function supplementalSectionNumbers(query: string): string[] {
  if (
    /प्रतिउत्तर|प्रतिवाद|prat[iu]?tuttar|pratibadi|prativadi|likhit.*prat|written reply|counter.?statement/i.test(
      query
    )
  ) {
    return ["99", "99.6", "100", "101", "102", "103", "104", "105"];
  }
  if (/म्याद\s*थप|extend.*time|extension/i.test(query)) {
    return ["105", "106", "271"];
  }
  return [];
}

/** Map query-analysis preferredAct label to a book scope id (boost hint only). */
export function preferredActToBookScope(preferredAct?: string): BookScope | null {
  if (!preferredAct) return null;
  const normalized = normalizeActToBookScope(preferredAct);
  if (normalized) return normalized;
  if (/देवानी.*कार्यविध|सिविल प्रक्रिया|civil procedure/i.test(preferredAct)) {
    return "civil-procedure";
  }
  if (/फौजदारी.*कार्यविध|criminal procedure/i.test(preferredAct)) {
    return "criminal-procedure";
  }
  if (/अपराध.*संहिता|criminal code/i.test(preferredAct)) {
    return "criminal-code";
  }
  if (
    /देवानी.*संहित|civil code|नागरिक संहिता/i.test(preferredAct) &&
    !/कार्यविध|procedure/i.test(preferredAct)
  ) {
    return "civil-code";
  }
  return null;
}

function sectionRootLabel(chunk: MatchedChunk): string {
  return chunk.section_label?.split(".")[0]?.trim() ?? "";
}

/**
 * Drop wrong-book chunks that share a दफा number with the preferred act
 * (e.g. civil-code ८२ marriage vs civil-procedure ८२ court-fee refund).
 */
export function dropCrossBookSectionHomonyms(
  chunks: MatchedChunk[],
  preferredScope: BookScope
): MatchedChunk[] {
  const inScope = chunks.filter((c) =>
    filenameMatchesScope(c.filename, preferredScope)
  );
  if (inScope.length === 0) return chunks;

  const scopedSections = new Set(
    inScope.map(sectionRootLabel).filter(Boolean)
  );

  return chunks.filter((c) => {
    if (filenameMatchesScope(c.filename, preferredScope)) return true;
    const root = sectionRootLabel(c);
    return !(root && scopedSections.has(root));
  });
}

const INTRO_CHAPTER_RE =
  /प्रारम्भिक|परिभाषा|फौजदारी न्यायका सामान्य|देवानी कानूनका सामान्य|सामान्य सिद्धान्त|सामान्य व्यवस्था/i;

function sectionRootNum(chunk: MatchedChunk): number {
  return Number(chunk.section_label?.split(".")[0] ?? 0);
}

/** Drop परिभाषा/सामान्य सिद्धान्त दफा when substantive provisions or hints target higher sections. */
export function dropIntroductoryDefinitionNoise(
  chunks: MatchedChunk[],
  sectionHints: SectionHint[] = []
): MatchedChunk[] {
  if (chunks.length <= 2) return chunks;

  const hintedMinByAct = new Map<string, number>();
  for (const hint of sectionHints) {
    const scope = normalizeActToBookScope(hint.act);
    if (!scope) continue;
    const num = Number(hint.section.replace(/[^\d.]/g, ""));
    if (!num) continue;
    const prev = hintedMinByAct.get(scope) ?? Infinity;
    if (num < prev) hintedMinByAct.set(scope, num);
  }

  const byBook = new Map<string, MatchedChunk[]>();
  for (const chunk of chunks) {
    const list = byBook.get(chunk.filename) ?? [];
    list.push(chunk);
    byBook.set(chunk.filename, list);
  }

  const kept: MatchedChunk[] = [];
  for (const [filename, bookChunks] of byBook) {
    const scope =
      LAW_BOOKS.find((b) => filenameMatchesScope(filename, b.id))?.id ?? null;
    const hintedMin = scope ? hintedMinByAct.get(scope) : undefined;
    const hasSubstantive = bookChunks.some((c) => {
      const root = sectionRootNum(c);
      if (hintedMin !== undefined && hintedMin >= 10) return root >= 10;
      return root >= 10;
    });

    for (const chunk of bookChunks) {
      const root = sectionRootNum(chunk);
      const header = `${chunk.chapter ?? ""} ${chunk.content.split("\n\n")[0] ?? ""}`;
      const isIntro =
        root <= 9 && root > 0 && INTRO_CHAPTER_RE.test(header);
      const belowHint =
        hintedMin !== undefined && hintedMin >= 10 && root > 0 && root < hintedMin;
      if (hasSubstantive && (isIntro || belowHint)) continue;
      kept.push(chunk);
    }
  }

  return kept.length > 0 ? kept : chunks;
}

/** Soft-boost preferred act; drop cross-book homonyms when act scope is known. */
export function filterAdvocateRetrievalChunks(
  chunks: MatchedChunk[],
  preferredAct?: string,
  query?: string,
  sectionHints: SectionHint[] = []
): MatchedChunk[] {
  if (isMarriageAgeQuery(query ?? "")) return chunks;
  if (chunks.length === 0) return chunks;

  const hintScopes = new Set(
    sectionHints
      .map((h) => normalizeActToBookScope(h.act))
      .filter((s): s is BookScope => Boolean(s))
  );

  let result = chunks;

  const boostScope =
    preferredActToBookScope(preferredAct) ??
    queryHintToBookScope(query ?? "");

  const homonymScope =
    hintScopes.size === 1 ? [...hintScopes][0] : boostScope && boostScope !== "auto" ? boostScope : null;

  if (homonymScope) {
    result = dropCrossBookSectionHomonyms(result, homonymScope);
    const inScope = result.filter((c) =>
      filenameMatchesScope(c.filename, homonymScope)
    );
    if (inScope.length >= 2) result = inScope;
  }

  if (!boostScope || boostScope === "auto") return result;

  const boost = Number(process.env.PREFERRED_ACT_BOOST ?? 0.12);
  return rerankWithActBoost(result, boostScope, boost);
}

function sectionRootFromHint(hint: SectionHint): string {
  return hint.section.replace(/[^\d.]/g, "").split(".")[0];
}

function chunkMatchesSectionHint(
  chunk: MatchedChunk,
  hint: SectionHint
): boolean {
  const scope = normalizeActToBookScope(hint.act);
  if (!scope || !filenameMatchesScope(chunk.filename, scope)) return false;
  const root = sectionRootLabel(chunk);
  return root === sectionRootFromHint(hint);
}

/** Move chunks matching LLM sectionHints to the front; drop wrong-act noise when hints hit. */
export function prioritizeSectionHintChunks(
  chunks: MatchedChunk[],
  sectionHints: SectionHint[]
): MatchedChunk[] {
  if (sectionHints.length === 0 || chunks.length === 0) return chunks;

  const hinted: MatchedChunk[] = [];
  const rest: MatchedChunk[] = [];
  for (const chunk of chunks) {
    if (sectionHints.some((h) => chunkMatchesSectionHint(chunk, h))) {
      hinted.push(chunk);
    } else {
      rest.push(chunk);
    }
  }

  if (hinted.length === 0) return chunks;

  const hintActs = new Set(
    sectionHints
      .map((h) => normalizeActToBookScope(h.act))
      .filter((s): s is BookScope => Boolean(s))
  );

  const filteredRest =
    hintActs.size === 1
      ? rest.filter((c) => {
          const act = [...hintActs][0];
          return filenameMatchesScope(c.filename, act);
        })
      : rest;

  return [...hinted, ...filteredRest];
}

/** Sort collapsed advocate chunks — hinted दफा first; never prefer civil-code when hints exist. */
export function sortAdvocateCollapsedChunks(
  chunks: MatchedChunk[],
  sectionHints: SectionHint[],
  preferHintOrder: boolean
): MatchedChunk[] {
  return [...chunks].sort((a, b) => {
    if (preferHintOrder && sectionHints.length > 0) {
      const aHint = sectionHints.some((h) => chunkMatchesSectionHint(a, h)) ? 0 : 1;
      const bHint = sectionHints.some((h) => chunkMatchesSectionHint(b, h)) ? 0 : 1;
      if (aHint !== bHint) return aHint - bHint;
      return sectionSortKey(a.section_label) - sectionSortKey(b.section_label);
    }
    return b.similarity - a.similarity;
  });
}

/** True when vector hits are weak or miss LLM section hints — trigger title search. */
export function needsTitleSearchFallback(
  chunks: MatchedChunk[],
  analysis: QueryAnalysis
): boolean {
  if (chunks.length === 0) return true;

  const hasHintHit =
    analysis.sectionHints.length > 0 &&
    analysis.sectionHints.some((hint) =>
      chunks.some((c) => chunkMatchesSectionHint(c, hint))
    );
  if (analysis.sectionHints.length > 0 && !hasHintHit) return true;

  const top = chunks.slice(0, 6);
  const allEarly = top.every((c) => {
    const root = sectionRootNum(c);
    return root > 0 && root <= 9;
  });
  const hintsTargetSubstantive = analysis.sectionHints.some(
    (h) => Number(sectionRootFromHint(h)) >= 10
  );
  if (allEarly && hintsTargetSubstantive) return true;

  const maxSim = Math.max(...chunks.map((c) => c.similarity ?? 0));
  if (maxSim < 0.45 && analysis.titleSearchHints.length + analysis.legalIssues.length > 0) {
    return true;
  }

  return false;
}

/** Nepali phrases for provision-title search from analysis + query. */
export function buildTitleSearchPhrases(
  analysis: QueryAnalysis,
  query: string
): string[] {
  const phrases = new Set<string>();
  for (const t of analysis.titleSearchHints) phrases.add(t);
  for (const issue of analysis.legalIssues) {
    if (issue.length >= 4 && issue.length <= 80) phrases.add(issue);
  }
  if (analysis.intent.length >= 6 && analysis.intent.length <= 100) {
    phrases.add(analysis.intent);
  }
  for (const rq of analysis.retrievalQueries) {
    if (rq.length >= 4 && rq.length <= 60 && !/[?]/.test(rq)) phrases.add(rq);
  }
  const q = query.trim();
  if (q.length >= 8 && q.length <= 120) phrases.add(q);
  return [...phrases].slice(0, 6);
}

/** Fallback act hint from query wording when analysis omits preferredAct. */
export function queryHintToBookScope(query: string): BookScope | null {
  if (isMarriageAgeQuery(query)) {
    return null;
  }
  if (/देवानी.*कार्यविधि|civil procedure|pratiuttar|written reply|फिराद|प्रतिउत्तर|मिलापत्र|अदालती\s*शुल्क|कोर्ट\s*फी|खारेज|kharej|म्याद तामेल|दरपीठ|घरसार|अग्रिम सूचना|जायजात.*जफत|जफत.*जायजात|बिगो\s*भराउ|धुल्याउ.*मिसिल|मिसिल.*धुल्याउ|फैसला.*कार्यान्वयन/i.test(query)) {
    return "civil-procedure";
  }
  if (/फौजदारी.*कार्यविधि|criminal procedure|अभियोग|जाहेरी|पक्राउ पुर्जी|पुर्पक्ष|साबिती|इजलास|बकपत्र/i.test(query)) {
    return "criminal-procedure";
  }
  if (/अपराध.*संहिता|criminal code|हत्या|चोरी|राजद्रोह|कीर्ते|ठगी|गाली|बेइमानी|अपहरण|गर्भपतन/i.test(query)) {
    return "criminal-code";
  }
  if (/देवानी.*संहिता|civil code|विवाह|करार|अंश|उत्तराधिकार|भाडा|दान/i.test(query)) {
    return "civil-code";
  }
  return null;
}

export function rerankWithActBoost(
  chunks: MatchedChunk[],
  preferredScope: BookScope,
  boost = 0.12
): MatchedChunk[] {
  if (!preferredScope || preferredScope === "auto") return chunks;
  return [...chunks]
    .map((chunk) => ({
      ...chunk,
      similarity: filenameMatchesScope(chunk.filename, preferredScope)
        ? chunk.similarity + boost
        : chunk.similarity,
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

export function isPratiuttarQuery(query: string): boolean {
  return /प्रतिउत्तर|प्रतिवाद|prat[iu]?tuttar|pratibadi|prativadi|likhit.*prat|pariuttar|written reply|counter.?statement/i.test(
    query
  );
}

/** प्रतिउत्तर filing deadline, extension, or timing — not general reply content. */
export function isPratiuttarDeadlineQuery(query: string): boolean {
  if (!isPratiuttarQuery(query)) return false;
  return /कति\s*दिन|दिनभित्र|म्याद|deadline|when|within.*day|कहिले|समय|थम|extend|extension|गुज्र|पेश\s*गर्न|दाखिल|file|filing/i.test(
    query
  );
}

/** Defendant reply deadline counted from म्याद तामेल date (दफा ११९), not court-issue order (दफा १०१). */
export function isPratiuttarAfterTamelDeadlineQuery(query: string): boolean {
  if (!isPratiuttarDeadlineQuery(query)) return false;
  return /म्याद\s*तामेल\s*भएको\s*मिति|बाटोको\s*म्यादबाहेक|बाटोको\s*म्याद\s*बाहेक/i.test(
    query
  );
}

/** मिलापत्र / settlement and अदालती शुल्क refund (दफा ८२). */
export function isMilapatraCourtFeeQuery(query: string): boolean {
  const hasSettlement =
    /मिलापत्र|मेलमिलाप|milapatra|settlement|compromise/i.test(query) ||
    (/मिल्न|मिले/i.test(query) &&
      /मुद्द|फैसला|पक्ष|अदालत/i.test(query));
  const hasCourtFee =
    /अदालती\s*शुल्क|court\s*fee|कोर्ट\s*फी|कोर्टफी/i.test(query) ||
    (/शुल्क|फी/i.test(query) && /अदालत|court|दर्ता/i.test(query));
  const hasRefund =
    /फिर्ता|refund|पाउँ|पाउं|firta|return.*fee/i.test(query);
  return hasSettlement && (hasCourtFee || hasRefund);
}

/** खारेज / dismiss and court-fee or payment refund (दफा ८२ उपदफा ४). */
export function isKharejCourtFeeRefundQuery(query: string): boolean {
  if (isMilapatraCourtFeeQuery(query)) return false;
  const hasDismiss =
    /खारेज|डिसमिस|dismiss|kharej|withdrawn|withdraw/i.test(query);
  const hasPayment =
    /अदालती\s*शुल्क|court\s*fee|कोर्ट\s*फी|शुल्क|फी|fee/i.test(query) ||
    /पैसा|paisa|रकम|tireko|तिरेको|tireko/i.test(query);
  const hasRefund =
    /फिर्ता|firta|refund|पाइन्छ|पाउँ|पाउं|painchha|paincha/i.test(query);
  return hasDismiss && hasPayment && hasRefund;
}

function sectionSortKey(label: string | null | undefined): number {
  if (!label) return 9999;
  const parts = label.split(".").map((p) => parseFloat(p) || 0);
  return parts[0] * 1000 + (parts[1] ?? 0);
}

export function isMarriageAgeQuery(query: string): boolean {
  return /बालविवाह|बाल विवाह|विवाह.*उमेर|उमेर.*विवाह|विवाह गर्नका/i.test(
    query
  );
}

export function isPolygamyQuery(query: string): boolean {
  return /बहुविवाह|बहु\s*विवाह|द्विविवाह|polygamy|bigamy/i.test(query);
}

export function isContractValidityQuery(query: string): boolean {
  return /करार.*मान्य|मान्य.*करार|करार.*सर्त|आवश्यक सर्त|valid contract|contract.*valid/i.test(
    query
  );
}

export function isMurderQuery(query: string): boolean {
  return /हत्या|murder|homicide|ज्यान मार/i.test(query);
}

export function isTheftQuery(query: string): boolean {
  return /चोरी|theft|steal/i.test(query);
}

export function isFalseComplaintQuery(query: string): boolean {
  return /false.*complaint|false.*criminal.*report|झुठ्ठा.*उजुर/i.test(query);
}

export function isCustodyPresentQuery(query: string): boolean {
  return (
    (/हिरासत|custody/i.test(query) &&
      /अदालत|court|पेश|present|अनुसन्धान|investigation/i.test(query)) ||
    /चौबीस घण्टा.*पेश|२४ घण्टा.*पेश|24 hour.*court/i.test(query)
  );
}

/** Police refused to register जाहेरी / complaint — फौजदारी कार्यविधि दफा ५. */
export function isJaheriRegistrationRefusalQuery(query: string): boolean {
  return (
    /जाहेरी|jaheri|jahiri/i.test(query) &&
    /दर्ता|darakhast|darta|register/i.test(query) &&
    /नमान|मानेन|इन्कार|manena|manen|refus|refuse|denied|deny/i.test(query)
  );
}

/** Drop wrong-act दफा homonyms; pin topic-specific दफा for advocate answers. */
export function focusAdvocateChunks(
  chunks: MatchedChunk[],
  query: string,
  preferredAct?: string
): MatchedChunk[] {
  if (isMarriageAgeQuery(query)) {
    const civil70 = chunks.filter(
      (c) =>
        filenameMatchesScope(c.filename, "civil-code") &&
        c.section_label?.split(".")[0] === "70"
    );
    const criminal173 = chunks.filter(
      (c) =>
        filenameMatchesScope(c.filename, "criminal-code") &&
        c.section_label?.split(".")[0] === "173"
    );
    const focused = [...civil70, ...criminal173];
    if (focused.length > 0) {
      return [...focused].sort(
        (a, b) => sectionSortKey(a.section_label) - sectionSortKey(b.section_label)
      );
    }
  }

  if (isPolygamyQuery(query)) {
    const criminal = chunks.filter((c) =>
      filenameMatchesScope(c.filename, "criminal-code")
    );
    const dafa175 = criminal.filter(
      (c) => c.section_label?.split(".")[0] === "175"
    );
    const dafa40 = criminal.filter(
      (c) => c.section_label?.split(".")[0] === "40"
    );
    if (dafa175.length > 0) {
      const focused = [...dafa175, ...dafa40];
      const roots = new Set(focused.map((c) => c.section_label?.split(".")[0]));
      const related = criminal.filter((c) => {
        const root = c.section_label?.split(".")[0];
        return root && !roots.has(root);
      });
      return [...focused, ...related].sort(
        (a, b) => sectionSortKey(a.section_label) - sectionSortKey(b.section_label)
      );
    }
  }

  const scope =
    preferredActToBookScope(preferredAct) ?? queryHintToBookScope(query);
  if (!scope || !isPratiuttarQuery(query)) {
    if (isCustodyPresentQuery(query)) {
      const dafa14 = chunks.filter(
        (c) =>
          filenameMatchesScope(c.filename, "criminal-procedure") &&
          c.section_label?.split(".")[0] === "14"
      );
      if (dafa14.length > 0) return dafa14;
    }
    if (isJaheriRegistrationRefusalQuery(query)) {
      const dafa5 = chunks.filter(
        (c) =>
          filenameMatchesScope(c.filename, "criminal-procedure") &&
          c.section_label?.split(".")[0] === "5"
      );
      if (dafa5.length > 0) return dafa5;
    }
    return chunks;
  }

  const primary = chunks.filter((c) => filenameMatchesScope(c.filename, scope));
  const focused = primary.length >= 4 ? primary : chunks;

  return [...focused].sort(
    (a, b) => sectionSortKey(a.section_label) - sectionSortKey(b.section_label)
  );
}

function advocateDafaGroupKey(chunk: MatchedChunk): string {
  const section = chunk.section_label?.split(".")[0] ?? "unknown";
  return `${chunk.filename}|${section}`;
}

function chunkTitleForMatch(chunk: MatchedChunk): string {
  return (
    chunk.section_title?.trim() ||
    chunk.content.match(/दफा\s*[:\s]+([^\n]+)/u)?.[1]?.trim() ||
    ""
  );
}

/** True punishment language — not mere hierarchical "उपदफा (" structure. */
function chunkHasPunishmentText(chunk: MatchedChunk): boolean {
  const title = chunkTitleForMatch(chunk);
  if (/सजाय|कैद|जरिबाना/u.test(title)) return true;
  return /सजाय|कैद|जरिबाना/u.test(chunk.content);
}

function isPreciseAdvocateDafa(
  chunk: MatchedChunk,
  query: string,
  hinted: boolean
): boolean {
  const title = chunkTitleForMatch(chunk);
  const titleScore = title ? scoreProvisionTitleMatch(query, title) : 0;
  const sim = chunk.similarity ?? 0;
  const asksPunishment = /सजाय|कैद|जरिबाना/.test(query);
  const hasPunishment = chunkHasPunishmentText(chunk);

  if (hinted && (titleScore >= 0.5 || sim >= 0.7)) return true;
  if (titleScore >= 0.65) return true;
  if (sim >= 0.88) return true;
  if (asksPunishment && hasPunishment && titleScore >= 0.45) return true;
  return false;
}

/**
 * Cap advocate output to ADVOCATE_DAFA_MAX unique दफा.
 * Stop at 1–2 when the top match(es) already contain a precise answer (esp. सजाय).
 */
export function limitAdvocateDafaChunks(
  chunks: MatchedChunk[],
  query: string,
  sectionHints: SectionHint[],
  preferHintOrder: boolean
): MatchedChunk[] {
  if (chunks.length === 0) return chunks;

  const hinted = (chunk: MatchedChunk) =>
    preferHintOrder &&
    sectionHints.some((h) => chunkMatchesSectionHint(chunk, h));

  const unique: MatchedChunk[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const key = advocateDafaGroupKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
    if (unique.length >= ADVOCATE_DAFA_MAX) break;
  }

  if (unique.length === 0) return chunks.slice(0, ADVOCATE_DAFA_MAX);

  const first = unique[0];
  if (unique.length === 1) return unique;

  // Preserve all retrieved metadata/hint दफा (e.g. २४१ offense + २४२ सजाय).
  const hintedRetrieved = unique.filter((c) => hinted(c));
  if (preferHintOrder && hintedRetrieved.length >= 2) {
    return hintedRetrieved.slice(0, ADVOCATE_DAFA_MAX);
  }

  const firstPrecise = isPreciseAdvocateDafa(first, query, hinted(first));
  const asksPunishment = /सजाय|कैद|जरिबाना/.test(query);
  const firstAnswersPunishment = chunkHasPunishmentText(first);

  // Only early-stop to a single दफा when that दफा itself states the सजाय.
  // Offense-definition दफा (e.g. २४१) often sort first but must not exclude सजाय दफा (२४२).
  if (firstPrecise && asksPunishment && firstAnswersPunishment) {
    return [first];
  }

  if (
    unique.length >= 2 &&
    firstPrecise &&
    isPreciseAdvocateDafa(unique[1], query, hinted(unique[1]))
  ) {
    return unique.slice(0, 2);
  }

  return unique;
}
