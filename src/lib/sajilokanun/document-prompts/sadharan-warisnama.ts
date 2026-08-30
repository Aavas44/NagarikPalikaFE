/**
 * साधारण वारिसनामा — General / simple Power of Attorney
 * Notary attestation suffices. Must NOT authorize land sale, court representation, settlement, or divorce (those require अधिकृत वारिसनामा + दफा १५३).
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

export type SadharanWarisnamaInputs = {
  principalName: string;
  principalAge: string;
  principalParents: string;
  principalAddress: string;
  principalCitizenship: string;
  attorneyName: string;
  attorneyAge: string;
  attorneyParents: string;
  attorneyAddress: string;
  attorneyCitizenship: string;
  relationship: string;
  purpose: string;
  powers: string;
  validityPeriod: string;
  witness1: WitnessInputs;
  witness2: WitnessInputs;
  date?: string;
};

export const SADHARAN_WARISNAMA_SYSTEM_PROMPT = `You are a legal document generation engine specializing in Nepali simple/general Power of Attorney (साधारण वारिसनामा / साधारण वारेसनामा) under the Muluki Dewani Karyabidhi Sanhita, 2074, sections 144–155.

This is a SIMPLE (साधारण) POA for routine, non-court, non-property tasks (banking, administrative follow-up, collecting documents, business correspondence). Notary Public attestation is sufficient. It is NOT interchangeable with अधिकृत वारिसनामा.

STRICT LIMITS:
- Do NOT authorize land sale or purchase, gift of immovable property, court representation as waris in a lawsuit, consent-settlement (मिलापत्र), withdrawal of a case, or divorce.
- If the user's listed powers include those consequential acts, rewrite them as a statement that such acts are excluded and require a separate अधिकृत वारिसनामा authenticated under दफा १५३.
- Do not invent facts, citizenship numbers, or extra powers.

Rules:
- Write the ENTIRE document in formal Nepali (Devanagari) only. Latin script only if present in the input.
- Follow the REQUIRED OUTPUT FORMAT exactly. No markdown or commentary outside the document.
- Use Devanagari numerals. Formal deed tone, ready for notary attestation.

REQUIRED OUTPUT FORMAT:

साधारण वारिसनामा
(मुलुकी देवानी कार्यविधि संहिता, २०७४ को दफा १४४ देखि १५५ सम्मको साधारण वारिस व्यवस्था बमोजिम)

लिखत नं.: ........................
मिति: [Date]

म/हामी तल उल्लेखित वारिसनामा दिने व्यक्ति स्वस्थ शरीर तथा स्वस्थ मस्तिष्कले, कुनै करकाप बिना, स्वेच्छाले यो साधारण वारिसनामा लेखिदिएको/दिएको छु/छौँ।

१. वारिसनामा दिने व्यक्तिको विवरण
नाम, उमेर, तीनपुस्ते, ठेगाना, नागरिकता नं.

२. वारिसनामा लिने व्यक्तिको विवरण
नाम, उमेर, तीनपुस्ते, ठेगाना, नागरिकता नं., नाता

३. प्रयोजन
(दैनिक/प्रशासनिक/बैंकिङ काम)

४. प्रदत्त अधिकारहरू
(क्रमागत — नियमित काम मात्र)

५. अधिकारको सीमा
यो साधारण वारिसनामाले जग्गा किनबेच, दान, मुद्दाको प्रतिनिधित्व, मिलापत्र, मुद्दा फिर्ता वा सम्बन्धविच्छेद गर्ने अधिकार दिँदैन। त्यस्ता कामका लागि दफा १५३ बमोजिम प्रमाणित अधिकृत वारिसनामा आवश्यक हुन्छ।

६. अधिकारको अवधि / समाप्ति
(दफा १५२ बमोजिम)

७. साक्षीहरू
साक्षी १: ...
साक्षी २: ...

प्रमाणीकरण:
यो साधारण वारिसनामा नोटरी पब्लिकबाट प्रमाणित गराइएको छ।

वारिसनामा दिने
सहीछाप / दायाँ औंठाछाप

वारिसनामा लिने
सहीछाप

साक्षी १ सहीछाप
साक्षी २ सहीछाप

नोटरी पब्लिक
दस्तखत, रजिस्ट्रेसन नं. र छाप`;

export function emptySadharanWarisnamaInputs(
  defaults?: Partial<SadharanWarisnamaInputs>
): SadharanWarisnamaInputs {
  return {
    principalName: defaults?.principalName ?? "",
    principalAge: defaults?.principalAge ?? "",
    principalParents: defaults?.principalParents ?? "",
    principalAddress: defaults?.principalAddress ?? "",
    principalCitizenship: defaults?.principalCitizenship ?? "",
    attorneyName: defaults?.attorneyName ?? "",
    attorneyAge: defaults?.attorneyAge ?? "",
    attorneyParents: defaults?.attorneyParents ?? "",
    attorneyAddress: defaults?.attorneyAddress ?? "",
    attorneyCitizenship: defaults?.attorneyCitizenship ?? "",
    relationship: defaults?.relationship ?? "",
    purpose: defaults?.purpose ?? "",
    powers: defaults?.powers ?? "",
    validityPeriod: defaults?.validityPeriod ?? "",
    witness1: defaults?.witness1 ?? emptyWitness(),
    witness2: defaults?.witness2 ?? emptyWitness(),
    date: defaults?.date,
  };
}

export function parseSadharanWarisnamaInputs(
  raw: unknown
): SadharanWarisnamaInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const inputs: SadharanWarisnamaInputs = {
    principalName: fieldStr(body, "principalName"),
    principalAge: fieldStr(body, "principalAge"),
    principalParents: fieldStr(body, "principalParents"),
    principalAddress: fieldStr(body, "principalAddress"),
    principalCitizenship: fieldStr(body, "principalCitizenship"),
    attorneyName: fieldStr(body, "attorneyName"),
    attorneyAge: fieldStr(body, "attorneyAge"),
    attorneyParents: fieldStr(body, "attorneyParents"),
    attorneyAddress: fieldStr(body, "attorneyAddress"),
    attorneyCitizenship: fieldStr(body, "attorneyCitizenship"),
    relationship: fieldStr(body, "relationship"),
    purpose: fieldStr(body, "purpose"),
    powers: fieldStr(body, "powers"),
    validityPeriod: fieldStr(body, "validityPeriod"),
    witness1: parseWitness(body, "witness1"),
    witness2: parseWitness(body, "witness2"),
    date: fieldStr(body, "date") || undefined,
  };
  if (!inputs.principalName || !inputs.attorneyName || !inputs.powers) {
    return null;
  }
  return inputs;
}

export function buildSadharanWarisnamaUserPrompt(
  inputs: SadharanWarisnamaInputs
): string {
  const date = formatDocumentDate(inputs.date);
  return `### INPUT DATA FIELDS:
1. वारिसनामा दिने (principal):
   - Name: ${nonEmpty(inputs.principalName)}
   - Age: ${nonEmpty(inputs.principalAge)}
   - Parents: ${nonEmpty(inputs.principalParents)}
   - Address: ${nonEmpty(inputs.principalAddress)}
   - Citizenship: ${nonEmpty(inputs.principalCitizenship)}
2. वारिसनामा लिने (attorney):
   - Name: ${nonEmpty(inputs.attorneyName)}
   - Age: ${nonEmpty(inputs.attorneyAge)}
   - Parents: ${nonEmpty(inputs.attorneyParents)}
   - Address: ${nonEmpty(inputs.attorneyAddress)}
   - Citizenship: ${nonEmpty(inputs.attorneyCitizenship)}
3. Relationship: ${nonEmpty(inputs.relationship)}
4. Purpose: ${nonEmpty(inputs.purpose)}
5. Routine powers only: ${nonEmpty(inputs.powers)}
6. Validity period: ${nonEmpty(inputs.validityPeriod)}
7. ${witnessLines("Witness 1", inputs.witness1)}
8. ${witnessLines("Witness 2", inputs.witness2)}
9. Date: ${date}

Generate the complete साधारण वारिसनामा now, following the REQUIRED OUTPUT FORMAT. Exclude land, court-waris, settlement, and divorce powers.`;
}
