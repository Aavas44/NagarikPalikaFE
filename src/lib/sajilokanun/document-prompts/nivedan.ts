/**
 * निवेदनपत्र — interim applications / petitions
 * Format: Supreme Court district-court निवेदन ढाँचा + Law Scholars Nepal petition layout.
 * Types: अन्तरिम आदेश, धरौटी/जमानत, स्थगन, म्याद थप.
 */

import {
  evidenceBlock,
  fieldStr,
  formatDocumentDate,
  nonEmpty,
} from "./common";

export const NIVEDAN_PETITION_TYPES = [
  "injunction",
  "bail",
  "stay",
  "deadline_extension",
] as const;

export type NivedanPetitionType = (typeof NIVEDAN_PETITION_TYPES)[number];

export type NivedanInputs = {
  petitionType: NivedanPetitionType;
  courtName: string;
  caseNo: string;
  caseType: string;
  petitionerName: string;
  petitionerParents: string;
  petitionerAddress: string;
  petitionerAgeId: string;
  opponentName: string;
  opponentAddress: string;
  facts: string;
  legalGrounds: string;
  reliefClaimed: string;
  attachedEvidence: string;
  date?: string;
};

const PETITION_META: Record<
  NivedanPetitionType,
  { subject: string; statuteHint: string }
> = {
  injunction: {
    subject: "अन्तरिम आदेश जारी गरिपाऊँ / यथास्थितिमा राखी पाउँ",
    statuteHint:
      "मुलुकी देवानी कार्यविधि संहिता, २०७४ दफा १५६ (अन्तर्कालीन आदेश); जिल्ला अदालत निवेदन ढाँचा — यथास्थितिमा राखी पाउँ, सम्पत्ति रोक्का राखी पाउँ।",
  },
  bail: {
    subject: "धरौटी / जमानत / धरौट तारेख पाऊँ",
    statuteHint:
      "मुलुकी फौजदारी कार्यविधि संहिता, २०७४ का धरौटी/जमानत सम्बन्धी व्यवस्था; सर्वोच्च अदालतको धरौट तथा जमानत निर्देशिका; जिल्ला अदालत निवेदन — धरौट तारेख पाऊँ, बैंक जमानत, नगद धरौटी दाखिला।",
  },
  stay: {
    subject: "स्थगन आदेश / मुद्दाको कारबाही रोकी पाउँ",
    statuteHint:
      "कारबाही स्थगन / अन्तरिम रोक सम्बन्धी निवेदन; जिल्ला अदालत निवेदन ढाँचा — मुद्दाको कारबाही रोकी पाउँ।",
  },
  deadline_extension: {
    subject: "गुज्रेको म्याद / तारिख थामी पाउँ",
    statuteHint:
      "जिल्ला अदालत निवेदन ढाँचा — गुज्रेको म्याद थामी पाउँ, गुज्रेको तारिख थामी पाउँ, हाजिर हुने अर्को म्याद पाउँ, गुज्रेको म्याद थामी प्रतिउत्तरपत्र/लिखित जवाफ दर्ता गरिपाऊँ।",
  },
};

export const NIVEDAN_SYSTEM_PROMPT = `You are a legal document generation engine specializing in Nepali court petitions (निवेदनपत्र) for district, high, and supreme courts.

Generate a formal निवेदन following the Supreme Court of Nepal district-court petition layout and Nepali pleading practice.

Rules:
- Write the ENTIRE document in formal Nepali (Devanagari) only. Do not use English words or Roman script except where the input data itself uses Latin script (names, case numbers).
- Follow the REQUIRED OUTPUT FORMAT exactly. Do not add markdown headings, bullet symbols other than Nepali numbering, or commentary outside the document.
- Expand each numbered section into polished formal legal Nepali paragraphs based on the INPUT DATA.
- Do not invent facts, parties, evidence, or case citations that are not supported by the INPUT DATA. You may use the statute hint for the petition type as a heading-level legal basis, but do not fabricate section numbers, case names, or evidence.
- Use Devanagari numerals (१, २, ३, ४).
- Keep tone formal, court-ready, and consistent with Nepali निवेदन practice.
- Closing must include: “यो निवेदन पत्रमा लेखिएको बेहोरा ठिक साँचो हो । झुठो ठहरे कानुन बमोजिम सहूँला बुझाउँला ।”

REQUIRED OUTPUT FORMAT:

श्री [Court Name] समक्ष पेश गरेको
निवेदनपत्र

विषयः [Subject line matching petition type]

मुद्दाः [Case Type]
मुद्दा नं.: [Case No.]

निवेदक:
[Petitioner name], [age/id], [father/mother], [address]
विरुद्ध
विपक्षी:
[Opponent name], [address]

म निवेदक निवेदन दस्तुर संलग्न गरी निम्न निवेदन गर्दछुः

१. (मुद्दाको संक्षिप्त तथ्य तथा हालसम्मको स्थिति)
...

२. (निवेदन गर्नुपर्ने कारण, तत्काल हानि तथा अपूरणीय क्षति)
...

३. (कानूनी आधार)
...

४. (माग दाबी / प्रार्थना)
अतः माथि उल्लिखित आधारमा [relief] गरिपाऊँ...

संलग्न प्रमाणहरू:
१. ...
२. ...

यो निवेदन पत्रमा लेखिएको बेहोरा ठिक साँचो हो । झुठो ठहरे कानुन बमोजिम सहूँला बुझाउँला ।

निवेदक
सहीछाप:
मिति: [Date]`;

export function emptyNivedanInputs(defaults?: Partial<NivedanInputs>): NivedanInputs {
  return {
    petitionType: defaults?.petitionType ?? "injunction",
    courtName: defaults?.courtName ?? "",
    caseNo: defaults?.caseNo ?? "",
    caseType: defaults?.caseType ?? "",
    petitionerName: defaults?.petitionerName ?? "",
    petitionerParents: defaults?.petitionerParents ?? "",
    petitionerAddress: defaults?.petitionerAddress ?? "",
    petitionerAgeId: defaults?.petitionerAgeId ?? "",
    opponentName: defaults?.opponentName ?? "",
    opponentAddress: defaults?.opponentAddress ?? "",
    facts: defaults?.facts ?? "",
    legalGrounds: defaults?.legalGrounds ?? "",
    reliefClaimed: defaults?.reliefClaimed ?? "",
    attachedEvidence: defaults?.attachedEvidence ?? "",
    date: defaults?.date,
  };
}

export function parseNivedanInputs(raw: unknown): NivedanInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const petitionTypeRaw = fieldStr(body, "petitionType");
  const petitionType = NIVEDAN_PETITION_TYPES.includes(
    petitionTypeRaw as NivedanPetitionType
  )
    ? (petitionTypeRaw as NivedanPetitionType)
    : null;
  if (!petitionType) return null;

  const inputs: NivedanInputs = {
    petitionType,
    courtName: fieldStr(body, "courtName"),
    caseNo: fieldStr(body, "caseNo"),
    caseType: fieldStr(body, "caseType"),
    petitionerName: fieldStr(body, "petitionerName"),
    petitionerParents: fieldStr(body, "petitionerParents"),
    petitionerAddress: fieldStr(body, "petitionerAddress"),
    petitionerAgeId: fieldStr(body, "petitionerAgeId"),
    opponentName: fieldStr(body, "opponentName"),
    opponentAddress: fieldStr(body, "opponentAddress"),
    facts: fieldStr(body, "facts"),
    legalGrounds: fieldStr(body, "legalGrounds"),
    reliefClaimed: fieldStr(body, "reliefClaimed"),
    attachedEvidence: fieldStr(body, "attachedEvidence"),
    date: fieldStr(body, "date") || undefined,
  };

  if (!inputs.courtName || !inputs.petitionerName || !inputs.caseNo) {
    return null;
  }
  return inputs;
}

export function buildNivedanUserPrompt(inputs: NivedanInputs): string {
  const meta = PETITION_META[inputs.petitionType];
  const date = formatDocumentDate(inputs.date);

  return `### INPUT DATA FIELDS:
1. Petition type: ${inputs.petitionType}
2. Subject line: ${meta.subject}
3. Statute hint (use only as general legal heading, do not invent extra citations): ${meta.statuteHint}
4. Court Name: ${nonEmpty(inputs.courtName)}
5. Case Number / Type: ${nonEmpty(inputs.caseNo)} & ${nonEmpty(inputs.caseType)}
6. निवेदक:
   - Name: ${nonEmpty(inputs.petitionerName)}
   - Father/Mother: ${nonEmpty(inputs.petitionerParents)}
   - Address: ${nonEmpty(inputs.petitionerAddress)}
   - Age/ID: ${nonEmpty(inputs.petitionerAgeId)}
7. विपक्षी:
   - Name: ${nonEmpty(inputs.opponentName)}
   - Address: ${nonEmpty(inputs.opponentAddress)}
8. Facts / current status: ${nonEmpty(inputs.facts)}
9. Legal grounds supplied by user: ${nonEmpty(inputs.legalGrounds)}
10. Relief claimed: ${nonEmpty(inputs.reliefClaimed)}
11. Attached Evidence:
${evidenceBlock(inputs.attachedEvidence)}
12. Date: ${date}

Generate the complete निवेदनपत्र now, following the REQUIRED OUTPUT FORMAT.`;
}
