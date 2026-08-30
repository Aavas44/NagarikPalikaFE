import type { CourtType } from "@/lib/sajilokanun/court-type";
import type { ExtractedCaseDocument } from "@/lib/sajilokanun/document-prompts/extract-case-document";
import type { CourtCategoryGroup } from "@/lib/sajilokanun-access";

export type CaseFormDraftFromExtraction = {
  title?: string;
  caseNo?: string;
  notes?: string;
  courtType?: CourtType;
  courtId?: string;
};

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s।.,_\-–—()/\\]+/g, "")
    .replace(/अदालत/g, "")
    .trim();
}

export function inferCourtTypeFromName(courtName: string | null | undefined): CourtType | null {
  if (!courtName) return null;
  const n = courtName.toLowerCase();
  if (n.includes("सर्वोच्च") || n.includes("supreme")) return "supreme";
  if (n.includes("विशेष") || n.includes("special")) return "special";
  if (n.includes("उच्च") || n.includes("high") || n.includes("patan") || n.includes("पाटन")) {
    return "high";
  }
  if (n.includes("जिल्ला") || n.includes("district")) return "district";
  return null;
}

function scoreCourtMatch(query: string, candidate: string): number {
  const q = normalizeMatchText(query);
  const c = normalizeMatchText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;
  // token overlap for multi-word Nepali names
  const qParts = query.split(/\s+/).map(normalizeMatchText).filter((p) => p.length > 1);
  const hits = qParts.filter((p) => c.includes(p)).length;
  if (hits === 0) return 0;
  return Math.min(70, 20 * hits);
}

export function matchCourtIdFromName(
  courtName: string | null | undefined,
  categories: CourtCategoryGroup[],
  courtType?: CourtType | null
): string | null {
  if (!courtName?.trim()) return null;
  let best: { id: string; score: number } | null = null;
  for (const group of categories) {
    if (courtType === "district" && group.id !== "district_courts") continue;
    if (courtType === "high" && group.id !== "high_courts") continue;
    if (courtType === "special" && group.id !== "special_courts") continue;
    if (courtType === "supreme") continue;
    for (const court of group.courts) {
      const score = Math.max(
        scoreCourtMatch(courtName, court.name),
        scoreCourtMatch(courtName, court.nameEn ?? "")
      );
      if (score > 0 && (!best || score > best.score)) {
        best = { id: court.id, score };
      }
    }
  }
  return best && best.score >= 40 ? best.id : null;
}

/** Build notes from extracted vitals that do not map to dedicated case fields. */
export function buildNotesFromExtraction(extracted: ExtractedCaseDocument): string {
  const lines: string[] = [];
  const court = extracted.अदालत_विवरण;
  if (court.दर्ता_मिति_वि_सं) {
    lines.push(`दर्ता मिति (वि.सं.): ${court.दर्ता_मिति_वि_सं}`);
  }
  const plaintiff = extracted.वादी_विवरण;
  if (plaintiff.पूरा_नाम) {
    lines.push(
      `वादी: ${plaintiff.पूरा_नाम}${plaintiff.तीनपुस्ते ? ` (${plaintiff.तीनपुस्ते})` : ""}`
    );
  }
  if (plaintiff.ठेगाना) lines.push(`वादी ठेगाना: ${plaintiff.ठेगाना}`);
  extracted.प्रतिवादी_विवरण.forEach((d, i) => {
    if (!d.पूरा_नाम) return;
    lines.push(
      `प्रतिवादी ${i + 1}: ${d.पूरा_नाम}${d.तीनपुस्ते ? ` (${d.तीनपुस्ते})` : ""}`
    );
    if (d.ठेगाना) lines.push(`प्रतिवादी ${i + 1} ठेगाना: ${d.ठेगाना}`);
  });
  const facts = extracted.आर्थिक_तथा_तथ्य;
  if (facts.बिगो_रकम_रु != null) {
    lines.push(`बिगो रकम: रु. ${facts.बिगो_रकम_रु}`);
  }
  if (facts.घटना_मिति_वि_सं) {
    lines.push(`घटना मिति (वि.सं.): ${facts.घटना_मिति_वि_सं}`);
  }
  if (facts.तथ्य_सारांश) lines.push(`तथ्य सारांश: ${facts.तथ्य_सारांश}`);
  if (extracted.कानूनी_आधार.उद्धृत_दफाहरू.length) {
    lines.push(`दफाहरू: ${extracted.कानूनी_आधार.उद्धृत_दफाहरू.join(", ")}`);
  }
  if (extracted.माग_दाबी.मुख्य_दाबी) {
    lines.push(`माग दाबी: ${extracted.माग_दाबी.मुख्य_दाबी}`);
  }
  return lines.join("\n");
}

export function mapExtractionToCaseDraft(
  extracted: ExtractedCaseDocument,
  courtCategories: CourtCategoryGroup[]
): CaseFormDraftFromExtraction {
  const subject = extracted.अदालत_विवरण.मुद्दाको_विषय?.trim() || "";
  const caseNo = extracted.अदालत_विवरण.मुद्दा_नं?.trim() || "";
  const courtName = extracted.अदालत_विवरण.अदालतको_नाम;
  const courtType = inferCourtTypeFromName(courtName) ?? undefined;
  const courtId =
    courtType && courtType !== "supreme"
      ? matchCourtIdFromName(courtName, courtCategories, courtType) ?? undefined
      : undefined;

  const plaintiff = extracted.वादी_विवरण.पूरा_नाम?.trim();
  const defendant = extracted.प्रतिवादी_विवरण.find((d) => d.पूरा_नाम)?.पूरा_नाम?.trim();
  const title =
    subject ||
    (plaintiff && defendant
      ? `${plaintiff} वि. ${defendant}`
      : plaintiff || defendant || "");

  return {
    title: title || undefined,
    caseNo: caseNo || undefined,
    notes: buildNotesFromExtraction(extracted) || undefined,
    courtType,
    courtId,
  };
}

export function familyTreeHasPeople(extracted: ExtractedCaseDocument | null | undefined): boolean {
  return Boolean(extracted?.वंशावली?.व्यक्तिहरू?.length);
}
