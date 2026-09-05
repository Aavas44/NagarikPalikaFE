import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";

const HAS_DEVANAGARI = /[\u0900-\u097F]/;

const KEY_LABELS_NE: Record<string, string> = {
  applicant_name: "निवेदकको नाम/थर",
  name: "नाम/थर",
  full_name: "नाम/थर",
  first_name: "नाम",
  last_name: "थर",
  citizen_name: "नागरिकको नाम",
  subject_person_name: "सम्बन्धित व्यक्तिको नाम",
  citizenship_no: "नागरिकता नं.",
  citizenship_number: "नागरिकता नं.",
  citizenship: "नागरिकता नं.",
  nagarikta: "नागरिकता नं.",
  contact_no: "सम्पर्क नं.",
  contact_number: "सम्पर्क नं.",
  phone: "सम्पर्क नं.",
  mobile: "मोबाइल नं.",
  address: "ठेगाना",
  applicant_address: "निवेदकको ठेगाना",
  permanent_address: "स्थायी ठेगाना",
  temporary_address: "अस्थायी ठेगाना",
  grandfather_name: "हजुरबुबाको नाम",
  grandmother_name: "हजुरआमाको नाम",
  father_name: "बुवाको नाम",
  mother_name: "आमाको नाम",
  spouse_name: "पति/पत्नीको नाम",
  husband_name: "पतिको नाम",
  wife_name: "पत्नीको नाम",
  son_name: "छोराको नाम",
  daughter_name: "छोरीको नाम",
  relation: "नाता",
  nata: "नाता",
  gender: "लिङ्ग",
  gender_title: "श्री/श्रीमती",
  shri_shrimati: "श्री/श्रीमती",
  age: "उमेर",
  occupation: "पेशा",
  signature: "दस्तखत",
  document_type: "कागजातको प्रकार",
  mismatch_field_1: "पहिलो फरक विवरण",
  mismatch_field_2: "दोस्रो फरक विवरण",
  mismatch_document_1: "पहिलो कागजात",
  mismatch_document_2: "दोस्रो कागजात",
  former_address: "साविक ठेगाना",
  former_ward: "साविक वडा नं.",
  remarks: "कैफियत",
  purpose: "प्रयोजन",
  subject: "विषय",
};

const PHRASE_LABELS_NE: Record<string, string> = {
  "applicant name": "निवेदकको नाम/थर",
  "full name": "नाम/थर",
  name: "नाम/थर",
  "citizenship no": "नागरिकता नं.",
  "citizenship no.": "नागरिकता नं.",
  "citizenship number": "नागरिकता नं.",
  citizenship: "नागरिकता नं.",
  "contact no": "सम्पर्क नं.",
  "contact no.": "सम्पर्क नं.",
  "contact number": "सम्पर्क नं.",
  phone: "सम्पर्क नं.",
  "mobile number": "मोबाइल नं.",
  address: "ठेगाना",
  "permanent address": "स्थायी ठेगाना",
  "grandfather name": "हजुरबुबाको नाम",
  "father name": "बुवाको नाम",
  "mother name": "आमाको नाम",
  "spouse name": "पति/पत्नीको नाम",
  relation: "नाता",
  "document type": "कागजातको प्रकार",
};

const TOKEN_NE: Record<string, string> = {
  applicant: "निवेदक",
  citizen: "नागरिक",
  name: "नाम",
  full: "पूरा",
  first: "पहिलो",
  last: "थर",
  surname: "थर",
  citizenship: "नागरिकता",
  nagarikta: "नागरिकता",
  contact: "सम्पर्क",
  phone: "फोन",
  mobile: "मोबाइल",
  number: "नं.",
  no: "नं.",
  address: "ठेगाना",
  permanent: "स्थायी",
  temporary: "अस्थायी",
  grandfather: "हजुरबुबा",
  grandmother: "हजुरआमा",
  father: "बुवा",
  mother: "आमा",
  spouse: "पति/पत्नी",
  husband: "पति",
  wife: "पत्नी",
  son: "छोरा",
  daughter: "छोरी",
  relation: "नाता",
  gender: "लिङ्ग",
  age: "उमेर",
  occupation: "पेशा",
  signature: "दस्तखत",
  document: "कागजात",
  type: "प्रकार",
  mismatch: "फरक विवरण",
  field: "क्षेत्र",
  former: "साविक",
  previous: "साविक",
  remarks: "कैफियत",
  purpose: "प्रयोजन",
  subject: "विषय",
  date: "मिति",
  district: "जिल्ला",
  ward: "वडा",
  local: "स्थानीय",
  level: "तह",
  municipality: "नगरपालिका",
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s.\-/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function fromTokens(normalizedKey: string): string | null {
  const parts = normalizedKey.split("_").filter(Boolean);
  if (parts.length === 0) return null;
  const translated = parts.map((part) => TOKEN_NE[part]).filter(Boolean);
  if (translated.length === 0) return null;
  if (translated.length === parts.length) {
    return translated.join(" ");
  }
  if (translated.length >= Math.ceil(parts.length / 2)) {
    return translated.join(" ");
  }
  return null;
}

const KEY_LABELS_EN: Record<string, string> = {
  applicant_name: "Applicant name",
  name: "Name",
  full_name: "Full name",
  first_name: "First name",
  last_name: "Surname",
  citizen_name: "Citizen name",
  subject_person_name: "Subject person name",
  citizenship_no: "Citizenship no.",
  citizenship_number: "Citizenship no.",
  citizenship: "Citizenship no.",
  nagarikta: "Citizenship no.",
  contact_no: "Contact no.",
  contact_number: "Contact no.",
  phone: "Contact no.",
  mobile: "Mobile no.",
  address: "Address",
  applicant_address: "Applicant address",
  permanent_address: "Permanent address",
  temporary_address: "Temporary address",
  grandfather_name: "Grandfather name",
  grandmother_name: "Grandmother name",
  father_name: "Father name",
  mother_name: "Mother name",
  spouse_name: "Spouse name",
  husband_name: "Husband name",
  wife_name: "Wife name",
  son_name: "Son name",
  daughter_name: "Daughter name",
  relation: "Relation",
  nata: "Relation",
  gender: "Gender",
  gender_title: "Shri / Shrimati",
  shri_shrimati: "Shri / Shrimati",
  age: "Age",
  occupation: "Occupation",
  signature: "Signature",
  document_type: "Document type",
  mismatch_field_1: "First mismatched field",
  mismatch_field_2: "Second mismatched field",
  mismatch_document_1: "First document",
  mismatch_document_2: "Second document",
  former_address: "Former address",
  former_ward: "Former ward no.",
  remarks: "Remarks",
  purpose: "Purpose",
  subject: "Subject",
};

function humanizeKey(key: string): string {
  return normalizeKey(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const TABLE_COLUMN_LABELS_NE: Record<string, string> = {
  क्र_सं: "क्र.सं.",
  नाम_थर: "नाम, थर",
  नागरिकता_जन्मदर्ता_नम्बर: "नागरिकता / जन्मदर्ता नं.",
  नाता: "नाता",
  कैफियत: "कैफियत",
  आम्दानीको_स्रोत: "आम्दानीको स्रोत",
  आय_आर्जन_गर्ने_व्यक्ति: "आय आर्जन गर्ने व्यक्ति",
  वार्षिक_आय_रकम: "वार्षिक आय रकम",
  निवेदकसँगको_नाता: "निवेदकसँगको नाता",
};

function numberedTableLabelNe(key: string): string | null {
  const match = key.trim().match(/^(.+)_(\d+)$/);
  if (!match) return null;
  const column = TABLE_COLUMN_LABELS_NE[match[1]];
  if (!column) return null;
  return `${column} (${toDevanagariDigits(match[2])})`;
}

export function wardEnglishFieldLabel(key: string, labelEn?: string): string {
  const normalized = normalizeKey(key);
  if (KEY_LABELS_EN[normalized]) return KEY_LABELS_EN[normalized];
  const en = (labelEn ?? "").trim();
  if (en && !HAS_DEVANAGARI.test(en)) return en.replace(/[:：]+$/g, "");
  return humanizeKey(key);
}

export function wardNepaliFieldLabel(
  key: string,
  labelNe?: string,
  labelEn?: string
): string {
  if (labelNe && HAS_DEVANAGARI.test(labelNe)) return labelNe.trim();
  const numbered = numberedTableLabelNe(key);
  if (numbered) return numbered;
  if (key && HAS_DEVANAGARI.test(key)) return key.trim();

  const normalized = normalizeKey(key);
  if (KEY_LABELS_NE[normalized]) return KEY_LABELS_NE[normalized];

  const en = (labelEn ?? "").trim().toLowerCase().replace(/[:：]+$/g, "");
  if (en && HAS_DEVANAGARI.test(en) === false && PHRASE_LABELS_NE[en]) {
    return PHRASE_LABELS_NE[en];
  }

  const fromKeyTokens = fromTokens(normalized);
  if (fromKeyTokens) return fromKeyTokens;

  const fromEnTokens = fromTokens(normalizeKey(en));
  if (fromEnTokens) return fromEnTokens;

  return labelNe?.trim() || labelEn?.trim() || key;
}

export function wardBilingualFieldLabel(
  key: string,
  labelNe?: string,
  labelEn?: string
): string {
  const nepali = wardNepaliFieldLabel(key, labelNe, labelEn);
  const english = wardEnglishFieldLabel(key, labelEn);
  if (!english || english === nepali || HAS_DEVANAGARI.test(english)) {
    return nepali;
  }
  if (nepali.includes(`(${english})`)) return nepali;
  return `${nepali} (${english})`;
}
