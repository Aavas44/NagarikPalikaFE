/**
 * Map this case's OCR extraction facts → SK template placeholder values.
 * Only copies values that exist in OCR / selected party data. Missing keys stay "".
 */
import {
  type ExtractedCaseDocument,
  type ExtractedPartyDetails,
} from "@/lib/sajilokanun/document-prompts/extract-case-document";
import {
  formatSametName,
  namesSimilar,
  resolvePartiesForGeneration,
  type PartyFillMode,
} from "@/lib/sajilokanun/party-fill";
import { formatItiSamvatParts } from "@/lib/nepaliCalendar";

export type SkFieldMeta = {
  key: string;
  label?: { en?: string; ne?: string };
  section?: string;
};

export type MapExtractionOptions = PartyFillMode & {
  /** Case number entered when the case was created — preferred over OCR. */
  caseNo?: string | null;
};

export type MapExtractionResult = {
  values: Record<string, string>;
  filledCount: number;
  blankCount: number;
  suggestedRowCount: number;
  applicantSide: "वादी" | "प्रतिवादी";
  partyMode: "single" | "samet";
  applicantNames: string[];
};

type FieldRole =
  | "applicant"
  | "opponent"
  | "plaintiff"
  | "defendant"
  | "court"
  | "case"
  | "facts"
  | "none";

type FieldAttr =
  | "name"
  | "address"
  | "district"
  | "municipality"
  | "ward"
  | "age"
  | "father"
  | "grandfather"
  | "lineage"
  | "citizenship"
  | "contact"
  | "gender"
  | "notes"
  | "court_name"
  | "case_number"
  | "case_subject"
  | "registration_date"
  | "incident_date"
  | "fact_summary"
  | "claim"
  | "court_fee"
  | "amount"
  | "legal_section"
  | "limitation"
  | "witness"
  | "year_bs"
  | "month_bs"
  | "day_bs"
  | "weekday"
  | "skip";

type ParsedField = {
  role: FieldRole;
  attr: FieldAttr;
  index: number | null;
};

const SKIP_KEY = /^(blank_\d+|unknown_\d+|खाली_ठाउँ_\d+|विवरण_भर्नुहोस्(?:_\d+)?)$/i;
const GENERIC_BLANK_LABEL =
  /blank field|खाली ठाउँ|unknown|विवरण भर्नुहोस्/i;
const DATE_PART_KEY = /^(संवत्|साल|महिना|गते|रोज)(?:_\d+)?$/;
const ATTACHMENT_FIELD =
  /संलग्न|कागज_प्रमाण|कागजप्रमाण|attached_evidence|annexure|enclosure/;
const ROW_SUFFIX = /_(\d+)$/;
const MAX_FILL_ROWS = 15;
const IDENTITY_ATTRS = new Set<FieldAttr>([
  "district",
  "municipality",
  "ward",
  "father",
  "grandfather",
  "address",
  "age",
  "gender",
  "citizenship",
  "contact",
  "lineage",
]);
const MUNI_ABBR =
  /न\s*\.?\s*पा\.?|गा\s*\.?\s*पा\.?|न_पा|गा_पा|n\.?\s*pa\.?|ga\.?\s*pa\.?/i;

function haystack(field: SkFieldMeta): string {
  return [field.key, field.label?.ne ?? "", field.label?.en ?? "", field.section ?? ""]
    .join(" ")
    .toLowerCase();
}

/** Placeholder key is the source of truth: {विपक्षीको_बाबुको_नाम} stays विपक्षी. */
function roleFromKey(key: string): FieldRole {
  if (/विपक्षी|vipakshi|bipakshi/i.test(key)) return "opponent";
  // Other-party identity blocks must not reuse निवेदक / case-party autofill.
  if (
    /^(?:हुनेको_|असक्षम_अर्धसक्षम_व्यक्तिको_|माथवर_प्रस्तावित_व्यक्तिको_|नाबालक_व्यक्तिको_|धर्मपुत्र_धर्मपुत्री_हुने_व्यक्तिको_|संरक्षक_हुनेको_|व्यक्तिको_)/i.test(
      key
    ) ||
    /(?:^|_)हुनेको_(?:नाम|लिङ्ग|उमेर|ठेगाना|नागरिकता|बाबु|बाजे)/.test(key)
  ) {
    return "none";
  }
  if (
    /^(?:दिनेको_|निवेदकको_|आवेदकको_)/i.test(key) ||
    /निवेदक|आवेदक|nivedak|nibedak/i.test(key)
  ) {
    return "applicant";
  }
  if (/प्रतिवादी|pratibadi|prativadi/i.test(key)) return "defendant";
  if (/(?:^|_)वादी(?:_|$)/.test(key) || /^वादी/.test(key)) return "plaintiff";
  return "none";
}

function roleFromMarkers(text: string): FieldRole {
  if (/विपक्षी|vipakshi|bipakshi|opposing|opponent/.test(text)) return "opponent";
  if (
    /(?:अधिकृत\s*)?वार[िे]स\s*हुने|वार[िे]सनामा\s*लिने|हुनेको|असक्षम|अर्धसक्षम|धर्मपुत्र.*हुने|माथवर\s*प्रस्तावित|नाबालक\s*व्यक्ति|व्यक्तिको\s*नाम/.test(
      text
    ) &&
    !/दिनेको|निवेदक|आवेदक/.test(text)
  ) {
    return "none";
  }
  if (/प्रतिवादी|pratibadi|prativadi|defendant|respondent/.test(text)) {
    return "defendant";
  }
  if (
    /दिनेको|वार[िे]सनामा\s*दिने|निवेदक|आवेदक|nivedak|nibedak|petitioner|applicant/.test(
      text
    )
  ) {
    return "applicant";
  }
  if (/(?:^|_)वादी(?:_|$)|plaintiff/.test(text) || /(^|\s)वादी/.test(text)) {
    return "plaintiff";
  }
  return "none";
}

function rowIndexFromKey(key: string): number | null {
  const match = key.trim().match(ROW_SUFFIX);
  if (!match) return null;
  const row = Number(match[1]);
  return Number.isInteger(row) && row > 0 ? row : null;
}

function parseFieldSemantics(field: SkFieldMeta): ParsedField {
  const key = field.key.trim();
  const text = haystack(field);
  const index = rowIndexFromKey(key);

  const blankWithoutMeaning =
    SKIP_KEY.test(key) &&
    (GENERIC_BLANK_LABEL.test(text) ||
      text.replace(key.toLowerCase(), "").trim().length < 3);
  if (blankWithoutMeaning || ATTACHMENT_FIELD.test(text)) {
    return { role: "none", attr: "skip", index };
  }
  if (
    field.section?.startsWith("table:") ||
    field.section?.startsWith("table-row:") ||
    /^tblx\d+_/.test(key)
  ) {
    return { role: "none", attr: "skip", index };
  }
  if (DATE_PART_KEY.test(key)) {
    if (/^संवत्|^साल/.test(key)) return { role: "none", attr: "year_bs", index };
    if (/^महिना/.test(key)) return { role: "none", attr: "month_bs", index };
    if (/^गते/.test(key)) return { role: "none", attr: "day_bs", index };
    return { role: "none", attr: "weekday", index };
  }
  if (/शुभम्|दस्तखत|हस्ताक्षर|signature/.test(text) && /नाम/.test(text) === false) {
    return { role: "none", attr: "skip", index };
  }

  let role: FieldRole = roleFromKey(key);
  if (role === "none") role = roleFromMarkers(text);

  let attr: FieldAttr = "skip";
  if (/बाजे|हजुरबुबा|हजुरबुवा|हजुरबा|grandfather/.test(text)) attr = "grandfather";
  else if (/बाबु|बुबा|बुवा|पिता|father/.test(text)) attr = "father";
  else if (/तीनपुस्ते|teenpuste|lineage/.test(text)) attr = "lineage";
  else if (/नागरिकता|citizenship/.test(text)) attr = "citizenship";
  else if (/सम्पर्क|मोबाइल|फोन|contact|phone|mobile/.test(text)) attr = "contact";
  else if (/लिङ्ग|linga|gender/.test(text)) attr = "gender";
  else if (/उमेर|age|वर्ष/.test(text) && !/आर्थिक_वर्ष/.test(text)) attr = "age";
  else if (/वडा/.test(text) || /ward/.test(text)) attr = "ward";
  else if (
    /गाउँपालिका|नगरपालिका|महानगर|स्थानीय_तह|municipality|local_level/.test(
      text
    ) ||
    MUNI_ABBR.test(text)
  ) {
    attr = "municipality";
  } else if (/जिल्ला|district/.test(text) && !/अदालत/.test(text)) attr = "district";
  else if (/ठेगाना|address/.test(text)) attr = "address";
  else if (/नाम_थर|नाम|थर|name|surname/.test(text)) attr = "name";
  else if (/टिप्पणी|notes/.test(text)) attr = "notes";

  if (
    role === "none" &&
    (IDENTITY_ATTRS.has(attr) || attr === "name") &&
    !/अदालत|court|मुद्दा/.test(text)
  ) {
    // Generic identity fields belong to निवेदक only when no other-party cue.
    const otherParty =
      /हुनेको|वार[िे]स\s*हुने|वार[िे]सनामा\s*लिने|असक्षम|अर्धसक्षम|धर्मपुत्र|माथवर|नाबालक|व्यक्तिको|संरक्षक\s*हुने/.test(
        text
      ) && !/दिनेको|निवेदक|आवेदक/.test(text);
    if (!otherParty) {
      role = "applicant";
    }
  }

  if (role !== "none" && attr !== "skip") {
    return { role, attr, index };
  }

  if (/अदालत/.test(text) || /court/.test(text)) {
    if (/मुद्दा_नं|केस_नं|case_no|case_number/.test(text)) {
      return { role: "case", attr: "case_number", index };
    }
    return { role: "court", attr: "court_name", index };
  }
  if (/मुद्दा[_को]*_?नं|मुद्दा_नम्बर|केस_नं|दर्ता_नं|case_no|case_number/.test(text)) {
    return { role: "case", attr: "case_number", index };
  }
  if (/मुद्दाको_नाम|मुद्दाको_विषय|विषय|case_subject|case_name/.test(text)) {
    return { role: "case", attr: "case_subject", index };
  }
  if (/दर्ता_मिति|registration_date/.test(text)) {
    return { role: "case", attr: "registration_date", index };
  }
  if (/घटना_मिति|incident_date/.test(text)) {
    return { role: "facts", attr: "incident_date", index };
  }
  if (/तथ्य|fact_summary|facts/.test(text)) {
    return { role: "facts", attr: "fact_summary", index };
  }
  if (/अदालत_शुल्क|court_fee/.test(text)) {
    return { role: "facts", attr: "court_fee", index };
  }
  if (/दाबी|claim/.test(text)) {
    return { role: "facts", attr: "claim", index };
  }
  if (/बिगो|रकम|amount|bigo/.test(text) && !/शुल्क/.test(text)) {
    return { role: "facts", attr: "amount", index };
  }
  if (/दफा|section|कानून|कानूनी/.test(text)) {
    return { role: "facts", attr: "legal_section", index };
  }
  if (/हदम्याद|limitation/.test(text)) {
    return { role: "facts", attr: "limitation", index };
  }
  if (/साक्षी|witness/.test(text)) {
    return { role: "facts", attr: "witness", index };
  }

  if (role !== "none" && attr === "skip" && /नाम/.test(text)) {
    return { role, attr: "name", index };
  }

  return { role: "none", attr: "skip", index };
}

function pickParty(
  list: ExtractedPartyDetails[],
  index: number | null,
  sametSingleSlot: boolean
): ExtractedPartyDetails | undefined {
  if (list.length === 0) return undefined;
  if (index == null) return list[0];
  if (sametSingleSlot && index === 1) return list[0];
  return list[index - 1];
}

function parseAddressParts(address: string | null | undefined): {
  district: string;
  municipality: string;
  ward: string;
} {
  const text = address?.trim() || "";
  if (!text) return { district: "", municipality: "", ward: "" };
  const district =
    text.match(/([^\s,]{2,40}?)\s*जिल्ला/)?.[1]?.trim() ||
    text.match(/जिल्ला\s+([^\s,]{2,40})/)?.[1]?.trim() ||
    "";
  const afterDistrict = text.split(/\s*जिल्ला\s*/)[1] ?? text;
  const municipalityFull = afterDistrict
    .match(
      /^\s*([^\n,]{2,50}?(?:महानगरपालिका|उपमहानगरपालिका|नगरपालिका|गाउँपालिका))/
    )?.[1]
    ?.trim();
  const municipalityAbbr = afterDistrict
    .match(/^\s*([^\s,]{2,40})\s*(?:न\s*\.?\s*पा\.?|गा\s*\.?\s*पा\.?)/)?.[1]
    ?.trim();
  const municipality = municipalityFull || municipalityAbbr || "";
  const ward =
    text.match(/वडा\s*नं\.?\s*[:.]?\s*([०-९0-9]+)/)?.[1] ||
    text.match(/वडा\s*नम्बर\s*[:.]?\s*([०-९0-9]+)/)?.[1] ||
    "";
  return { district, municipality, ward };
}

function parseFatherName(lineage: string | null | undefined): string {
  const text = lineage?.trim() || "";
  if (!text) return "";
  const labeled = text.match(/बाबु[:\s]+([^,;/]+)/)?.[1]?.trim();
  if (labeled) return labeled;
  const matches = [
    ...text.matchAll(/([^,;/]{2,80}?)\s*को\s*(?:छोरा|छोरी)/g),
  ];
  return matches.at(-1)?.[1]?.trim() || "";
}

function parseGrandfatherName(lineage: string | null | undefined): string {
  const text = lineage?.trim() || "";
  if (!text) return "";
  const labeled = text.match(/बाजे[:\s]+([^,;/]+)/)?.[1]?.trim();
  if (labeled) return labeled;
  const matches = [
    ...text.matchAll(/([^,;/]{2,80}?)\s*को\s*(?:नाति|नातिनी)/g),
  ];
  return matches.at(-1)?.[1]?.trim() || "";
}

function relativeFromTree(
  extracted: ExtractedCaseDocument | null | undefined,
  party: ExtractedPartyDetails,
  kind: "father" | "grandfather"
): string {
  const people = extracted?.वंशावली?.व्यक्तिहरू ?? [];
  if (people.length === 0) return "";
  const self = people.find((person) =>
    namesSimilar(person.नाम, party.पूरा_नाम ?? "")
  );
  if (!self) return "";
  const want =
    kind === "father" ? /बाबु|पिता/ : /बाजे|हजुरबुबा|हजुरबा|grandfather/;
  for (const id of self.अभिभावक_आईडीहरू ?? []) {
    const parent = people.find((person) => person.आईडी === id);
    if (parent && want.test(parent.नाता || "")) {
      return parent.नाम.trim();
    }
  }
  if (kind === "father") {
    const parent = people.find(
      (person) => person.आईडी === self.अभिभावक_आईडीहरू?.[0]
    );
    return parent?.नाम.trim() || "";
  }
  const father = people.find(
    (person) => person.आईडी === self.अभिभावक_आईडीहरू?.[0]
  );
  const grandfather = people.find(
    (person) => person.आईडी === father?.अभिभावक_आईडीहरू?.[0]
  );
  return grandfather?.नाम.trim() || "";
}

function partyAttr(
  party: ExtractedPartyDetails | undefined,
  attr: FieldAttr,
  allForName: ExtractedPartyDetails[],
  useSametName: boolean,
  extracted?: ExtractedCaseDocument | null
): string {
  if (attr === "name") {
    if (useSametName) return formatSametName(allForName);
    return party?.पूरा_नाम?.trim() || "";
  }
  if (!party) return "";
  const addressParts = parseAddressParts(party.ठेगाना);
  switch (attr) {
    case "address":
      return party.ठेगाना?.trim() || "";
    case "district":
      return addressParts.district;
    case "municipality":
      return addressParts.municipality;
    case "ward":
      return addressParts.ward;
    case "age":
      return party.उमेर?.trim() || "";
    case "father":
      return (
        parseFatherName(party.तीनपुस्ते) ||
        relativeFromTree(extracted, party, "father")
      );
    case "grandfather":
      return (
        parseGrandfatherName(party.तीनपुस्ते) ||
        relativeFromTree(extracted, party, "grandfather")
      );
    case "lineage":
      return party.तीनपुस्ते?.trim() || "";
    case "citizenship":
      return party.नागरिकता_नं?.trim() || "";
    case "contact":
      return party.सम्पर्क?.trim() || "";
    case "gender":
      return party.लिङ्ग?.trim() || "";
    case "notes":
      return party.टिप्पणी?.trim() || "";
    default:
      return "";
  }
}

function listValue(items: string[], index: number | null): string {
  if (items.length === 0) return "";
  if (index == null) return items.join("\n");
  return items[index - 1] ?? "";
}

function footerDateValue(attr: FieldAttr): string {
  const parts = formatItiSamvatParts();
  if (attr === "year_bs") return parts.साल;
  if (attr === "month_bs") return parts.महिना;
  if (attr === "day_bs") return parts.गते;
  if (attr === "weekday") return parts.रोज;
  return "";
}

function caseNumberValue(
  options: MapExtractionOptions,
  extracted: ExtractedCaseDocument | null | undefined
): string {
  const fromCase = options.caseNo?.trim() || "";
  if (fromCase) return fromCase;
  return extracted?.अदालत_विवरण.मुद्दा_नं?.trim() || "";
}

/**
 * Map extraction → template placeholder values for this case only.
 * Unmapped / unknown keys stay "". Never invents citizenship, case numbers, or amounts.
 */
export function mapExtractionToSkValues(
  extracted: ExtractedCaseDocument | null | undefined,
  fields: SkFieldMeta[],
  options: MapExtractionOptions = {}
): MapExtractionResult {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = "";
  }

  const applyStandaloneDefaults = () => {
    let filled = 0;
    for (const field of fields) {
      const parsed = parseFieldSemantics(field);
      let value = "";
      if (parsed.attr === "case_number") {
        value = caseNumberValue(options, extracted);
      } else {
        value = footerDateValue(parsed.attr);
      }
      if (value) {
        values[field.key] = value;
        filled += 1;
      }
    }
    return filled;
  };

  if (!extracted) {
    const filledCount = applyStandaloneDefaults();
    return {
      values,
      filledCount,
      blankCount: fields.length - filledCount,
      suggestedRowCount: 1,
      applicantSide: options.casePartySide === "defendant" ? "प्रतिवादी" : "वादी",
      partyMode: "samet",
      applicantNames: [],
    };
  }

  const resolved = resolvePartiesForGeneration(extracted, options);
  const court = extracted.अदालत_विवरण;
  const facts = extracted.आर्थिक_तथा_तथ्य;
  let filledCount = 0;

  for (const field of fields) {
    const parsed = parseFieldSemantics(field);
    if (parsed.attr === "skip") continue;

    const singleSlot = parsed.index == null;
    let value = "";

    if (parsed.role === "applicant") {
      value = partyAttr(
        pickParty(resolved.applicants, parsed.index, singleSlot),
        parsed.attr,
        resolved.applicants,
        singleSlot && parsed.attr === "name" && resolved.mode === "samet",
        extracted
      );
    } else if (parsed.role === "opponent") {
      value = partyAttr(
        pickParty(resolved.opponents, parsed.index, singleSlot),
        parsed.attr,
        resolved.opponents,
        singleSlot && parsed.attr === "name" && resolved.opponents.length > 1,
        extracted
      );
    } else if (parsed.role === "plaintiff") {
      const samet =
        resolved.side === "वादी" &&
        singleSlot &&
        parsed.attr === "name" &&
        resolved.mode === "samet";
      value = partyAttr(
        pickParty(resolved.plaintiffs, parsed.index, singleSlot),
        parsed.attr,
        resolved.plaintiffs,
        samet,
        extracted
      );
    } else if (parsed.role === "defendant") {
      const samet =
        resolved.side === "प्रतिवादी" &&
        singleSlot &&
        parsed.attr === "name" &&
        resolved.mode === "samet";
      value = partyAttr(
        pickParty(resolved.defendants, parsed.index, singleSlot),
        parsed.attr,
        resolved.defendants,
        samet,
        extracted
      );
    } else if (
      parsed.attr === "year_bs" ||
      parsed.attr === "month_bs" ||
      parsed.attr === "day_bs" ||
      parsed.attr === "weekday"
    ) {
      value = footerDateValue(parsed.attr);
    } else if (parsed.role === "court") {
      value = court.अदालतको_नाम?.trim() || "";
    } else if (parsed.role === "case") {
      if (parsed.attr === "case_number") value = caseNumberValue(options, extracted);
      else if (parsed.attr === "case_subject") value = court.मुद्दाको_विषय?.trim() || "";
      else if (parsed.attr === "registration_date") {
        value = court.दर्ता_मिति_वि_सं?.trim() || "";
      }
    } else if (parsed.role === "facts") {
      if (parsed.attr === "fact_summary") value = facts.तथ्य_सारांश?.trim() || "";
      else if (parsed.attr === "incident_date") {
        value = facts.घटना_मिति_वि_सं?.trim() || "";
      } else if (parsed.attr === "claim") {
        value = extracted.माग_दाबी.मुख्य_दाबी?.trim() || "";
      } else if (parsed.attr === "court_fee") {
        value = extracted.माग_दाबी.अदालत_शुल्क_दाबी?.trim() || "";
      } else if (parsed.attr === "amount") {
        value = facts.बिगो_रकम_रु != null ? String(facts.बिगो_रकम_रु) : "";
      } else if (parsed.attr === "legal_section") {
        value = extracted.कानूनी_आधार.उद्धृत_दफाहरू.join(", ");
      } else if (parsed.attr === "limitation") {
        value = extracted.कानूनी_आधार.हदम्याद_स्थिति?.trim() || "";
      } else if (parsed.attr === "witness") {
        value = listValue(extracted.साक्षीहरू, parsed.index);
      }
    }

    if (value) {
      values[field.key] = value;
      filledCount += 1;
    }

    const isFirstNumberedRow = parsed.index === 1 && /_1$/.test(field.key);
    if (!isFirstNumberedRow) continue;
    const extraCount =
      parsed.role === "applicant" || (parsed.role === "plaintiff" && resolved.side === "वादी")
        ? resolved.applicants.length
        : parsed.role === "opponent" ||
            (parsed.role === "defendant" && resolved.side === "प्रतिवादी")
          ? resolved.opponents.length
          : parsed.role === "plaintiff"
            ? resolved.plaintiffs.length
            : parsed.role === "defendant"
              ? resolved.defendants.length
              : parsed.attr === "witness"
                ? extracted.साक्षीहरू.length
                : 1;
    for (let row = 2; row <= Math.min(MAX_FILL_ROWS, extraCount); row += 1) {
      const extraKey = field.key.replace(/_1$/, `_${row}`);
      const extraField = { ...field, key: extraKey };
      const extraParsed = parseFieldSemantics(extraField);
      let extraValue = "";
      if (extraParsed.role === "applicant") {
        extraValue = partyAttr(
          pickParty(resolved.applicants, extraParsed.index, false),
          extraParsed.attr,
          resolved.applicants,
          false,
          extracted
        );
      } else if (extraParsed.role === "opponent") {
        extraValue = partyAttr(
          pickParty(resolved.opponents, extraParsed.index, false),
          extraParsed.attr,
          resolved.opponents,
          false,
          extracted
        );
      } else if (extraParsed.role === "plaintiff") {
        extraValue = partyAttr(
          pickParty(resolved.plaintiffs, extraParsed.index, false),
          extraParsed.attr,
          resolved.plaintiffs,
          false,
          extracted
        );
      } else if (extraParsed.role === "defendant") {
        extraValue = partyAttr(
          pickParty(resolved.defendants, extraParsed.index, false),
          extraParsed.attr,
          resolved.defendants,
          false,
          extracted
        );
      } else if (extraParsed.attr === "witness") {
        extraValue = listValue(extracted.साक्षीहरू, extraParsed.index);
      }
      values[extraKey] = extraValue;
      if (extraValue) filledCount += 1;
    }
  }

  const suggestedRowCount = Math.min(
    MAX_FILL_ROWS,
    Math.max(1, resolved.applicants.length)
  );

  return {
    values,
    filledCount,
    blankCount: fields.length - filledCount,
    suggestedRowCount,
    applicantSide: resolved.side,
    partyMode: resolved.mode,
    applicantNames: resolved.applicants
      .map((party) => party.पूरा_नाम?.trim() || "")
      .filter(Boolean),
  };
}
