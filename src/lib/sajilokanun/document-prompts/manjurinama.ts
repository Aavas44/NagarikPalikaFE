/**
 * मन्जुरीनामा — Consent deed
 * Consenter identity, subject of consent, beneficiary, property/case particulars, conditions, two witnesses.
 */

import {
  emptyWitness,
  fieldStr,
  formatDocumentDate,
  nonEmpty,
  parseWitness,
  witnessLines,
  type WitnessInputs,
} from "./common";

export type ManjurinamaInputs = {
  consenterName: string;
  consenterAge: string;
  consenterParents: string;
  consenterAddress: string;
  consenterCitizenship: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  consentSubject: string;
  propertyOrCaseDetails: string;
  conditions: string;
  witness1: WitnessInputs;
  witness2: WitnessInputs;
  date?: string;
};

export const MANJURINAMA_SYSTEM_PROMPT = `You are a legal document generation engine specializing in Nepali consent deeds (मन्जुरीनामा / मञ्जुरनामा).

A मन्जुरीनामा records that a named person freely consents to a specified act, transaction, property dealing, or court step in favour of a beneficiary. It is used in land, family, banking, and litigation practice. Embassy/IRD specimens require in-person identity, a clear consent subject, and witnesses.

Rules:
- Write the ENTIRE document in formal Nepali (Devanagari) only. Latin script only if present in the input.
- Follow the REQUIRED OUTPUT FORMAT exactly. No markdown or commentary outside the document.
- Do not invent facts, kitta numbers, case numbers, or conditions that are not in the INPUT DATA.
- State that consent is free, without करकाप, धम्की or भ्रम.
- Closing must include: “यो मन्जुरीनामामा लेखिएको बेहोरा ठिक साँचो हो । झुठो ठहरे कानुन बमोजिम सहूँला बुझाउँला ।”
- Use Devanagari numerals. Formal deed tone.

REQUIRED OUTPUT FORMAT:

मन्जुरीनामा

लिखत नं.: ........................
मिति: [Date]

म/हामी तल उल्लेखित व्यक्ति स्वस्थ शरीर तथा स्वस्थ मस्तिष्कले, कुनै करकाप, धम्की वा भ्रम बिना, स्वेच्छाले देहायको विषयमा मन्जुरी व्यक्त गर्दछु/गर्दछौँ।

१. मन्जुरी दिने व्यक्तिको विवरण
नाम, उमेर, तीनपुस्ते, ठेगाना, नागरिकता नं.

२. मन्जुरी लिने / लाभान्वित व्यक्तिको विवरण
नाम, ठेगाना

३. मन्जुरीको विषय
...

४. सम्पत्ति / मुद्दा / कारोबारको विवरण
...

५. सर्त तथा सीमा
...

६. साक्षीहरू
साक्षी १: ...
साक्षी २: ...

यो मन्जुरीनामामा लेखिएको बेहोरा ठिक साँचो हो । झुठो ठहरे कानुन बमोजिम सहूँला बुझाउँला ।

मन्जुरी दिने
सहीछाप / दायाँ औंठाछाप
फोटो

मन्जुरी लिने
सहीछाप

साक्षी १ सहीछाप
साक्षी २ सहीछाप`;

export function emptyManjurinamaInputs(
  defaults?: Partial<ManjurinamaInputs>
): ManjurinamaInputs {
  return {
    consenterName: defaults?.consenterName ?? "",
    consenterAge: defaults?.consenterAge ?? "",
    consenterParents: defaults?.consenterParents ?? "",
    consenterAddress: defaults?.consenterAddress ?? "",
    consenterCitizenship: defaults?.consenterCitizenship ?? "",
    beneficiaryName: defaults?.beneficiaryName ?? "",
    beneficiaryAddress: defaults?.beneficiaryAddress ?? "",
    consentSubject: defaults?.consentSubject ?? "",
    propertyOrCaseDetails: defaults?.propertyOrCaseDetails ?? "",
    conditions: defaults?.conditions ?? "",
    witness1: defaults?.witness1 ?? emptyWitness(),
    witness2: defaults?.witness2 ?? emptyWitness(),
    date: defaults?.date,
  };
}

export function parseManjurinamaInputs(raw: unknown): ManjurinamaInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const inputs: ManjurinamaInputs = {
    consenterName: fieldStr(body, "consenterName"),
    consenterAge: fieldStr(body, "consenterAge"),
    consenterParents: fieldStr(body, "consenterParents"),
    consenterAddress: fieldStr(body, "consenterAddress"),
    consenterCitizenship: fieldStr(body, "consenterCitizenship"),
    beneficiaryName: fieldStr(body, "beneficiaryName"),
    beneficiaryAddress: fieldStr(body, "beneficiaryAddress"),
    consentSubject: fieldStr(body, "consentSubject"),
    propertyOrCaseDetails: fieldStr(body, "propertyOrCaseDetails"),
    conditions: fieldStr(body, "conditions"),
    witness1: parseWitness(body, "witness1"),
    witness2: parseWitness(body, "witness2"),
    date: fieldStr(body, "date") || undefined,
  };
  if (!inputs.consenterName || !inputs.consentSubject) {
    return null;
  }
  return inputs;
}

export function buildManjurinamaUserPrompt(inputs: ManjurinamaInputs): string {
  const date = formatDocumentDate(inputs.date);
  return `### INPUT DATA FIELDS:
1. मन्जुरी दिने:
   - Name: ${nonEmpty(inputs.consenterName)}
   - Age: ${nonEmpty(inputs.consenterAge)}
   - Parents: ${nonEmpty(inputs.consenterParents)}
   - Address: ${nonEmpty(inputs.consenterAddress)}
   - Citizenship: ${nonEmpty(inputs.consenterCitizenship)}
2. मन्जुरी लिने / beneficiary:
   - Name: ${nonEmpty(inputs.beneficiaryName)}
   - Address: ${nonEmpty(inputs.beneficiaryAddress)}
3. Consent subject: ${nonEmpty(inputs.consentSubject)}
4. Property / case / transaction details: ${nonEmpty(inputs.propertyOrCaseDetails)}
5. Conditions: ${nonEmpty(inputs.conditions)}
6. ${witnessLines("Witness 1", inputs.witness1)}
7. ${witnessLines("Witness 2", inputs.witness2)}
8. Date: ${date}

Generate the complete मन्जुरीनामा now, following the REQUIRED OUTPUT FORMAT.`;
}
