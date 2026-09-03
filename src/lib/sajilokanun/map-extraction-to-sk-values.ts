/**
 * Map this case's OCR extraction facts → SK template field values.
 * Only call when the open case already has documentExtraction.
 */
import {
  defendantParties,
  plaintiffParties,
  type ExtractedCaseDocument,
  type ExtractedPartyDetails,
} from "@/lib/sajilokanun/document-prompts/extract-case-document";

export type SkFieldMeta = {
  key: string;
  label?: { en?: string; ne?: string };
  section?: string;
};

function partyValue(
  party: ExtractedPartyDetails | undefined,
  kind: "name" | "address" | "father" | "citizenship" | "age" | "contact" | "notes"
): string {
  if (!party) return "";
  switch (kind) {
    case "name":
      return party.पूरा_नाम?.trim() || "";
    case "address":
      return party.ठेगाना?.trim() || "";
    case "father":
    case "notes":
      return (kind === "father" ? party.तीनपुस्ते : party.टिप्पणी)?.trim() || "";
    case "citizenship":
      return party.नागरिकता_नं?.trim() || "";
    case "age":
      return party.उमेर?.trim() || "";
    case "contact":
      return party.सम्पर्क?.trim() || "";
    default:
      return "";
  }
}

/** Build a flat semantic lookup from extraction (plaintiff_1_name, court_name, …). */
export function buildSemanticVitalsMap(
  extracted: ExtractedCaseDocument
): Record<string, string> {
  const out: Record<string, string> = {};
  const court = extracted.अदालत_विवरण;
  if (court.अदालतको_नाम) out.court_name = court.अदालतको_नाम;
  if (court.मुद्दा_नं) out.case_number = court.मुद्दा_नं;
  if (court.मुद्दाको_विषय) out.case_subject = court.मुद्दाको_विषय;
  if (court.दर्ता_मिति_वि_सं) {
    out.registration_date = court.दर्ता_मिति_वि_सं;
    out.date_bs = court.दर्ता_मिति_वि_सं;
  }

  const facts = extracted.आर्थिक_तथा_तथ्य;
  if (facts.तथ्य_सारांश) out.fact_summary = facts.तथ्य_सारांश;
  if (facts.घटना_मिति_वि_सं) out.incident_date = facts.घटना_मिति_वि_सं;
  if (facts.बिगो_रकम_रु != null) {
    out.amount_npr = String(facts.बिगो_रकम_रु);
    out.bigo_amount = String(facts.बिगो_रकम_रु);
  }

  if (extracted.माग_दाबी.मुख्य_दाबी) out.claim_main = extracted.माग_दाबी.मुख्य_दाबी;
  if (extracted.माग_दाबी.अदालत_शुल्क_दाबी) {
    out.court_fee = extracted.माग_दाबी.अदालत_शुल्क_दाबी;
  }
  if (extracted.कानूनी_आधार.उद्धृत_दफाहरू.length) {
    out.legal_section = extracted.कानूनी_आधार.उद्धृत_दफाहरू.join(", ");
  }
  if (extracted.कानूनी_आधार.हदम्याद_स्थिति) {
    out.limitation_status = extracted.कानूनी_आधार.हदम्याद_स्थिति;
  }

  extracted.साक्षीहरू.forEach((w, i) => {
    out[`witness_${i + 1}`] = w;
  });
  extracted.प्रमाणहरू.forEach((e, i) => {
    out[`evidence_${i + 1}`] = e;
  });

  const fillParty = (
    prefixes: string[],
    parties: ExtractedPartyDetails[]
  ) => {
    parties.forEach((party, index) => {
      const n = index + 1;
      for (const prefix of prefixes) {
        const base = `${prefix}_${n}`;
        const name = partyValue(party, "name");
        const address = partyValue(party, "address");
        const father = partyValue(party, "father");
        const citizenship = partyValue(party, "citizenship");
        const age = partyValue(party, "age");
        const contact = partyValue(party, "contact");
        if (name) {
          out[`${base}_name`] = name;
          out[`${prefix}_name`] = out[`${prefix}_name`] || name;
        }
        if (address) out[`${base}_address`] = address;
        if (father) {
          out[`${base}_father`] = father;
          out[`${base}_teenpuste`] = father;
          out[`${base}_lineage`] = father;
        }
        if (citizenship) out[`${base}_citizenship`] = citizenship;
        if (age) out[`${base}_age`] = age;
        if (contact) out[`${base}_contact`] = contact;
      }
    });
  };

  fillParty(["plaintiff", "petitioner", "vadi", "nivedak"], plaintiffParties(extracted));
  fillParty(
    ["defendant", "respondent", "prativadi", "bipakshi"],
    defendantParties(extracted)
  );

  return out;
}

function scoreKeyMatch(fieldKey: string, vitalsKey: string): number {
  if (fieldKey === vitalsKey) return 100;
  if (fieldKey.endsWith(`_${vitalsKey}`) || vitalsKey.endsWith(`_${fieldKey}`)) {
    return 80;
  }
  // plaintiff_1_full_name ↔ plaintiff_1_name
  const a = fieldKey.replace(/_full_name$/, "_name");
  const b = vitalsKey.replace(/_full_name$/, "_name");
  if (a === b) return 90;
  if (fieldKey.includes(vitalsKey) || vitalsKey.includes(fieldKey)) return 50;
  return 0;
}

/**
 * Map extraction → template placeholder values for this case only.
 * Unmapped keys stay "".
 */
export function mapExtractionToSkValues(
  extracted: ExtractedCaseDocument | null | undefined,
  fields: SkFieldMeta[]
): { values: Record<string, string>; filledCount: number } {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = "";
  }
  if (!extracted) {
    return { values, filledCount: 0 };
  }

  const vitals = buildSemanticVitalsMap(extracted);
  const vitalsKeys = Object.keys(vitals);
  let filledCount = 0;

  for (const field of fields) {
    const key = field.key;
    if (/^blank_\d+$/i.test(key) || /^unknown_\d+$/i.test(key)) {
      continue;
    }
    if (vitals[key]) {
      values[key] = vitals[key];
      filledCount += 1;
      continue;
    }
    let best: { score: number; value: string } | null = null;
    for (const vk of vitalsKeys) {
      const score = scoreKeyMatch(key, vk);
      if (score >= 80 && vitals[vk] && (!best || score > best.score)) {
        best = { score, value: vitals[vk] };
      }
    }
    if (best) {
      values[key] = best.value;
      filledCount += 1;
    }
  }

  return { values, filledCount };
}
