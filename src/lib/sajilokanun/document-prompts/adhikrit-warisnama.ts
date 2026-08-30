/**
 * अधिकृत वारिसनामा — Special / Authorized Power of Attorney
 * Muluki Dewani Karyabidhi Sanhita, 2074 §§ 144–155, especially §153 authentication and §154 express powers.
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

export type AdhikritWarisnamaInputs = {
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
  courtName: string;
  caseNo: string;
  propertyDetails: string;
  authenticationPlace: string;
  validityPeriod: string;
  witness1: WitnessInputs;
  witness2: WitnessInputs;
  date?: string;
};

export const ADHIKRIT_WARISNAMA_SYSTEM_PROMPT = `You are a legal document generation engine specializing in Nepali Power of Attorney (अधिकृत वारिसनामा / अधिकृत वारेसनामा) under the Muluki Dewani Karyabidhi Sanhita, 2074, sections 144–155.

This is an AUTHORIZED (अधिकृत) POA — not a simple/general POA. It is used for land sale/purchase, court representation, consent-settlement of suits, withdrawal of cases, gift of property, and similar consequential acts. Section 153 requires in-person authentication by a District Court judge in Nepal or by the Nepali Ambassador / Consul-General abroad. Section 154 requires EXPRESS authority for land transactions, settlement, gift, and withdrawal.

Rules:
- Write the ENTIRE document in formal Nepali (Devanagari) only. Do not use English words or Roman script except where the input data itself uses Latin script.
- Follow the REQUIRED OUTPUT FORMAT exactly. No markdown headings or commentary outside the document.
- Do not invent kitta numbers, case numbers, citizenship numbers, or powers that are not in the INPUT DATA. If a land or case field is empty, write that the specific particulars will be as stated by the principal, without fabricating identifiers.
- Name only the powers the user listed. Recite that acts under दफा १५४ (मिलापत्र, जग्गा किनबेच, दान, मुद्दा फिर्ता) require express mention — include them only if the user listed them.
- Use Devanagari numerals. Formal deed tone, ready for District Court / Embassy authentication.
- Two original copies are customary (one retained by the authenticating authority).

REQUIRED OUTPUT FORMAT:

अधिकृत वारिसनामा
(मुलुकी देवानी कार्यविधि संहिता, २०७४ को दफा १४४–१५५ बमोजिम)

लिखत नं.: ........................
मिति: [Date]

म/हामी तल उल्लेखित वारिसनामा दिने व्यक्ति स्वस्थ शरीर तथा स्वस्थ मस्तिष्कले, कुनै करकाप, धम्की वा भ्रम बिना, स्वेच्छाले यो अधिकृत वारिसनामा लेखिदिएको/दिएको छु/छौँ।

१. वारिसनामा दिने व्यक्तिको विवरण (प्रधान / अधिकार दिने)
नाम: ...
उमेर: ...
बाबु/आमा (तीनपुस्ते): ...
ठेगाना: ...
नागरिकता / परिचय पत्र नं.: ...

२. वारिसनामा लिने व्यक्तिको विवरण (वारिस / अधिकार लिने)
नाम: ...
उमेर: ...
बाबु/आमा (तीनपुस्ते): ...
ठेगाना: ...
नागरिकता / परिचय पत्र नं.: ...
दिने र लिनेबीचको नाता: ...

३. अधिकार प्रदान गर्ने प्रयोजन
...

४. प्रदत्त अधिकारहरू (दफा १५४ बमोजिम स्पष्ट उल्लेख)
(क्रमागत बुँदामा मात्र प्रयोगकर्ताले दिएका अधिकार)

५. मुद्दा / जग्गाको किटानी विवरण
मुद्दा नं. / अदालत: ...
जग्गा (कित्ता, वडा, नगर/गाउँपालिका): ...

६. अधिकारको अवधि / समाप्ति
...
(दफा १५२ बमोजिम काम पूरा भएमा, अवधि सकिएमा, दिने वा लिनेको मृत्यु भएमा, लिखत फिर्ता भएमा अधिकार स्वतः समाप्त हुनेछ।)

७. साक्षीहरू
साक्षी १: ...
साक्षी २: ...

प्रमाणीकरण:
यो अधिकृत वारिसनामा मुलुकी देवानी कार्यविधि संहिता, २०७४ को दफा १५३ बमोजिम श्री [District Court / Embassy] समक्ष वारिसनामा दिने व्यक्ति स्वयं उपस्थित भई सहीछाप, औंठाछाप र फोटो संलग्न गरी प्रमाणित गराइएको छ। दुई सक्कल प्रति तयार गरिएको छ।

वारिसनामा दिने
सहीछाप / दायाँ औंठाछाप
फोटो

वारिसनामा लिने
सहीछाप / दायाँ औंठाछाप

साक्षी १ सहीछाप
साक्षी २ सहीछाप

प्रमाणित गर्ने अधिकारी
(जिल्ला न्यायाधीश / राजदूत / महावाणिज्यदूत)
दस्तखत, पद र कार्यालयको छाप`;

export function emptyAdhikritWarisnamaInputs(
  defaults?: Partial<AdhikritWarisnamaInputs>
): AdhikritWarisnamaInputs {
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
    courtName: defaults?.courtName ?? "",
    caseNo: defaults?.caseNo ?? "",
    propertyDetails: defaults?.propertyDetails ?? "",
    authenticationPlace: defaults?.authenticationPlace ?? "",
    validityPeriod: defaults?.validityPeriod ?? "",
    witness1: defaults?.witness1 ?? emptyWitness(),
    witness2: defaults?.witness2 ?? emptyWitness(),
    date: defaults?.date,
  };
}

export function parseAdhikritWarisnamaInputs(
  raw: unknown
): AdhikritWarisnamaInputs | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const inputs: AdhikritWarisnamaInputs = {
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
    courtName: fieldStr(body, "courtName"),
    caseNo: fieldStr(body, "caseNo"),
    propertyDetails: fieldStr(body, "propertyDetails"),
    authenticationPlace: fieldStr(body, "authenticationPlace"),
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

export function buildAdhikritWarisnamaUserPrompt(
  inputs: AdhikritWarisnamaInputs
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
5. Express powers (दफा १५४ — list only these): ${nonEmpty(inputs.powers)}
6. Court / case: ${nonEmpty(inputs.courtName)} / ${nonEmpty(inputs.caseNo)}
7. Property / kitta details: ${nonEmpty(inputs.propertyDetails)}
8. Authentication authority (जिल्ला अदालत / राजदूतावास): ${nonEmpty(inputs.authenticationPlace)}
9. Validity period: ${nonEmpty(inputs.validityPeriod)}
10. ${witnessLines("Witness 1", inputs.witness1)}
11. ${witnessLines("Witness 2", inputs.witness2)}
12. Date: ${date}

Generate the complete अधिकृत वारिसनामा now, following the REQUIRED OUTPUT FORMAT.`;
}
