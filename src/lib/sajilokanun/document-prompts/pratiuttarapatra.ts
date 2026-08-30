/**
 * प्रतिउत्तरपत्र (Written Statement / Reply) — Muluki Criminal Procedure Code, 2074
 * Statutory schedule format: प्रतिउत्तरपत्रको ढाँचा
 */

export type PratiuttarAllegationPoint = {
  charge: string;
  defense: string;
};

export type PratiuttarapatraInputs = {
  courtName: string;
  plaintiffName: string;
  defendantName: string;
  caseType: string;
  caseNo: string;
  defendantFullName: string;
  defendantParents: string;
  defendantAddress: string;
  defendantAgeId: string;
  allegationPoints: PratiuttarAllegationPoint[];
  legalGrounds: string;
  reliefClaimed: string;
  attachedEvidence: string;
  date?: string;
};

export const PRATIUTTARAPATRA_SYSTEM_PROMPT = `You are a legal document generation engine specializing in Nepali law under the Muluki Criminal Procedure Code, 2074.
Generate a formal Written Statement (प्रतिउत्तरपत्र) following the statutory schedule format (प्रतिउत्तरपत्रको ढाँचा).

Rules:
- Write the ENTIRE document in formal Nepali (Devanagari) only. Do not use English words or Roman script except where the input data itself uses Latin script (names, case numbers).
- Follow the REQUIRED OUTPUT FORMAT exactly. Do not add markdown headings, bullet symbols other than Nepali numbering, or commentary outside the document.
- Expand each numbered section into polished formal legal Nepali paragraphs based on the INPUT DATA.
- Do not invent facts, parties, evidence, or legal citations that are not supported by the INPUT DATA. Where a field is thin, write a brief, careful formulation without fabricating details.
- Use Devanagari numerals for section numbers (१, २, ३, ४).
- Keep tone formal, court-ready, and consistent with Nepali pleading practice.

REQUIRED OUTPUT FORMAT:

श्री [Court Name] समक्ष पेश गरेको
प्रतिउत्तरपत्र

मुद्दा: [Case Type/Name]
मुद्दा नं.: [Case No.]

[Plaintiff Name] ................................................................ वादी
विरुद्ध
[Defendant Name], उमेर [Age], [Address] ....................................... प्रतिउत्तरदाता / प्रतिवादी

मुद्दाः [Case Name] विषयमा देहाय बमोजिम प्रतिउत्तरपत्र पेश गर्दछु/गर्दछौँ:

१. (प्रतिवादीको परिचय तथा संक्षिप्त पृष्ठभूमि)
...

२. (दाबीको खण्डन तथा वस्तुगत तथ्य)
...

३. (कानूनी आधार तथा नजिरहरू)
...

४. (माग दाबी / निवेदन)
अतः वादी पक्षबाट लगाइएको झुठ्ठा अभियोगबाट पूर्ण सफाइ पाउँ...

संलग्न प्रमाणहरू:
१. ...
२. ...

ऋतम्बन्धी / निवेदक (सहीछाप):
मिति: [Date]`;

function nonEmpty(value: string | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function buildPratiuttarapatraUserPrompt(
  inputs: PratiuttarapatraInputs
): string {
  const points = inputs.allegationPoints
    .map((point, index) => {
      const n = index + 1;
      return `   - Point ${n}: ${nonEmpty(point.charge)} -> Defense: ${nonEmpty(point.defense)}`;
    })
    .join("\n");

  const evidenceLines = inputs.attachedEvidence
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const evidenceBlock =
    evidenceLines.length > 0
      ? evidenceLines.map((line, i) => `   ${i + 1}. ${line}`).join("\n")
      : "   (none listed)";

  const date =
    inputs.date?.trim() ||
    new Intl.DateTimeFormat("ne-NP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());

  return `### INPUT DATA FIELDS:
1. Court Name: ${nonEmpty(inputs.courtName)}
2. Case Title: ${nonEmpty(inputs.plaintiffName)} विरुद्ध ${nonEmpty(inputs.defendantName)}
3. Case Number / Type: ${nonEmpty(inputs.caseNo)} & ${nonEmpty(inputs.caseType)}
4. Defendant Details:
   - Full Name: ${nonEmpty(inputs.defendantFullName || inputs.defendantName)}
   - Father/Mother Name: ${nonEmpty(inputs.defendantParents)}
   - Address: ${nonEmpty(inputs.defendantAddress)}
   - Age/ID: ${nonEmpty(inputs.defendantAgeId)}
5. Points of Allegation to Refute:
${points || "   - (none provided)"}
6. Legal Grounds: ${nonEmpty(inputs.legalGrounds)}
7. Relief Claimed: ${nonEmpty(inputs.reliefClaimed)}
8. Attached Evidence:
${evidenceBlock}
9. Date: ${date}

Generate the complete प्रतिउत्तरपत्र now, following the REQUIRED OUTPUT FORMAT.`;
}

export function parsePratiuttarapatraInputs(
  raw: unknown
): PratiuttarapatraInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;

  const allegationPointsRaw = Array.isArray(body.allegationPoints)
    ? body.allegationPoints
    : [];
  const allegationPoints: PratiuttarAllegationPoint[] = allegationPointsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const charge = typeof row.charge === "string" ? row.charge.trim() : "";
      const defense = typeof row.defense === "string" ? row.defense.trim() : "";
      if (!charge && !defense) return null;
      return { charge, defense };
    })
    .filter((item): item is PratiuttarAllegationPoint => item !== null);

  const str = (key: string) =>
    typeof body[key] === "string" ? (body[key] as string).trim() : "";

  const inputs: PratiuttarapatraInputs = {
    courtName: str("courtName"),
    plaintiffName: str("plaintiffName"),
    defendantName: str("defendantName"),
    caseType: str("caseType"),
    caseNo: str("caseNo"),
    defendantFullName: str("defendantFullName"),
    defendantParents: str("defendantParents"),
    defendantAddress: str("defendantAddress"),
    defendantAgeId: str("defendantAgeId"),
    allegationPoints:
      allegationPoints.length > 0
        ? allegationPoints
        : [{ charge: "", defense: "" }],
    legalGrounds: str("legalGrounds"),
    reliefClaimed: str("reliefClaimed"),
    attachedEvidence: str("attachedEvidence"),
    date: str("date") || undefined,
  };

  if (!inputs.courtName || !inputs.plaintiffName || !inputs.defendantName) {
    return null;
  }
  if (!inputs.caseNo || !inputs.caseType) {
    return null;
  }

  return inputs;
}
