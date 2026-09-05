import type { WardOperatorProfile, WardTemplateVariable } from "@/lib/ward-access";
import { formatBsDate, getTodayBs } from "@/lib/nepaliCalendar";
import { toDevanagariDigits } from "@/lib/sajilokanun/nepali-digits";
import { BS_MONTHS_NE } from "@/lib/nepaliCalendarTypes";

const LOCAL_BODY_LABELS_NE: Record<string, string> = {
  nagarpalika: "नगरपालिका",
  gaupalika: "गाउँपालिका",
  mahanagarpalika: "महानगरपालिका",
};

export const WARD_AUTO_FIELD_META: {
  key: string;
  label: string;
}[] = [
  { key: "application_date", label: "आवेदन मिति (Application date)" },
  { key: "today", label: "मिति (Date)" },
  { key: "मिति", label: "मिति (Date)" },
  { key: "current_address", label: "हालको ठेगाना (Current address)" },
  { key: "निवेदकको_ठेगाना", label: "निवेदकको ठेगाना (Applicant address)" },
  { key: "current_district_name", label: "हालको जिल्ला (Current district name)" },
  { key: "current_applicant_local_level", label: "हालको स्थानीय तह (Current applicant local level)" },
  { key: "current_applicant_ward_no", label: "हालको वडा नं. (Current applicant ward no.)" },
  { key: "district_name", label: "जिल्ला (District)" },
  { key: "जिल्ला", label: "जिल्ला (District)" },
  { key: "local_body_name", label: "स्थानीय तह (Local level)" },
  { key: "स्थानीय_तह", label: "स्थानीय तह (Local level)" },
  { key: "नगरपालिका_वा_गाउँपालिका", label: "स्थानीय तह (Local level)" },
  { key: "local_body_type", label: "स्थानीय तहको प्रकार (Local body type)" },
  { key: "ward_no", label: "वडा नं. (Ward no.)" },
  { key: "operator_name", label: "सञ्चालकको नाम (Operator name)" },
  { key: "former_local_body_type", label: "पूर्व स्थानीय तहको प्रकार (Former local body type)" },
  { key: "former_local_body_name", label: "पूर्व स्थानीय तह (Former local body)" },
  { key: "former_ward_no", label: "पूर्व वडा नं. (Former ward no.)" },
  { key: "former_address", label: "साविक ठेगाना (Former address)" },
  { key: "साविक_ठेगाना", label: "साविक ठेगाना (Former address)" },
];

export function formatTodayBsLongNe(): string {
  const date = getTodayBs();
  const year = toDevanagariDigits(String(date.year));
  const day = toDevanagariDigits(String(date.day));
  const monthName = BS_MONTHS_NE[date.month - 1];
  return `${year} साल ${monthName} ${day} गते`;
}

export function formatTodayBsShortNe(): string {
  return formatBsDate(getTodayBs(), "ne").replace(/\s+\([^)]+\)$/, "");
}

export function formatWardLocalLevelName(
  typeOrProfile: WardOperatorProfile | string,
  localBodyName?: string
): string {
  if (typeof typeOrProfile === "string") {
    const typeLabel = LOCAL_BODY_LABELS_NE[typeOrProfile] ?? "";
    const name = (localBodyName ?? "").trim();
    if (!typeLabel) return name;
    if (
      name.includes(typeLabel) ||
      /नगरपालिका|गाउँपालिका|गाउपालिका|महानगरपालिका/.test(name)
    ) {
      return name;
    }
    return `${name} ${typeLabel}`.trim();
  }
  return formatWardLocalLevelName(
    typeOrProfile.localBodyType,
    typeOrProfile.localBodyName
  );
}

export function formatWardCurrentAddress(profile: WardOperatorProfile): string {
  return formatApplicantAddressFromParts(
    formatWardLocalLevelName(profile),
    profile.wardNo,
    profile.districtName
  );
}

/** Compose निवेदकको ठेगाना from स्थानीय तह + वडा + जिल्ला. */
export function formatApplicantAddressFromParts(
  localLevel: string,
  wardNo: string,
  district: string
): string {
  const ward = toDevanagariDigits(String(wardNo ?? "").trim());
  const level = localLevel.trim();
  const jilla = district.trim();
  const wardPart = ward ? `वडा नं. ${ward}` : "";
  const left = [level, wardPart].filter(Boolean).join("-");
  return [left, jilla].filter(Boolean).join(", ");
}

export function formatWardFormerAddress(profile: WardOperatorProfile): string {
  const localLevel = formatWardLocalLevelName(
    profile.formerLocalBodyType,
    profile.formerLocalBodyName
  );
  const wardNo = toDevanagariDigits(profile.formerWardNo);
  return `${localLevel} - ${wardNo} ${profile.districtName}`.replace(/\s+/g, " ").trim();
}

function looksLikeOpponentField(key: string): boolean {
  return /विपक्षी|प्रतिवादी|respondent|defendant|opponent|opposite/i.test(key);
}

function looksLikeCourtField(key: string): boolean {
  return /अदालत|court/i.test(key);
}

function looksLikeFormerField(key: string): boolean {
  return /साविक|पूर्व|former|previous|savik/i.test(key);
}

function looksLikeApplicantAddressField(key: string): boolean {
  if (looksLikeFormerField(key)) return false;
  return (
    key === "निवेदकको_ठेगाना" ||
    key === "applicant_address" ||
    /निवेदक.*ठेगाना/.test(key) ||
    /(^|_)(applicant_address|current_address)(_|$)/i.test(key) ||
    key === "हालको_ठेगाना" ||
    key === "ठेगाना"
  );
}

/** Fill जिल्ला / स्थानीय तह / वडा from the operator profile when the template key matches. */
export function wardProfileValueForKey(
  profile: WardOperatorProfile,
  key: string
): string | undefined {
  const vars = buildWardProfileVariables(profile);
  if (vars[key]?.trim()) return vars[key];
  const compact = key.trim().replace(/[\s.\-/]+/g, "_");
  if (compact !== key && vars[compact]?.trim()) return vars[compact];

  if (looksLikeOpponentField(key) || looksLikeCourtField(key)) return undefined;

  if (looksLikeFormerField(key)) {
    if (/ठेगाना|address/i.test(key)) return vars.former_address;
    if (/वडा|ward/i.test(key)) return vars.former_ward_no;
    if (/स्थानीय|नगरपालिका|गाउँ?पालिका|महानगर|local/i.test(key)) {
      return vars.former_local_body_name;
    }
    return undefined;
  }

  if (looksLikeApplicantAddressField(key) || looksLikeApplicantAddressField(compact)) {
    return vars.current_address || formatWardCurrentAddress(profile);
  }

  if (/जिल्ला/.test(key) || /(^|_)(district|jilla)(_|$)/i.test(key)) {
    return profile.districtName;
  }
  if (
    /स्थानीय.?तह/.test(key) ||
    /नगरपालिका/.test(key) ||
    /गाउँ?पालिका/.test(key) ||
    /महानगरपालिका/.test(key) ||
    /(local_body|local_level|municipality|nagarpalika|gaupalika)/i.test(key)
  ) {
    return formatWardLocalLevelName(profile);
  }
  if (/वडा/.test(key) || /(^|_)ward(_|$)/i.test(key)) {
    if (/नाम|name/i.test(key)) return undefined;
    return toDevanagariDigits(profile.wardNo);
  }
  if (looksLikeTodayDateField(key) || looksLikeTodayDateField(compact)) {
    return formatTodayBsLongNe();
  }
  return undefined;
}

function looksLikeTodayDateField(key: string): boolean {
  if (
    /जन्म|नागरिकता|घटना|दर्ता|निधन|विवाह|expire|birth|citizenship|incident|death|marriage|issue/i.test(
      key
    )
  ) {
    return false;
  }
  return (
    key === "मिति" ||
    key === "miti" ||
    key === "date" ||
    key === "today" ||
    /^(आजको_)?मिति$/.test(key) ||
    /आवेदन.?मिति/.test(key)
  );
}

export function buildWardProfileVariables(
  profile: WardOperatorProfile
): Record<string, string> {
  const bodyType =
    LOCAL_BODY_LABELS_NE[profile.localBodyType] ?? profile.localBodyType;
  const formerBodyType =
    LOCAL_BODY_LABELS_NE[profile.formerLocalBodyType] ??
    profile.formerLocalBodyType;
  const localLevel = formatWardLocalLevelName(profile);
  const todayNe = formatTodayBsLongNe();
  const wardNoNe = toDevanagariDigits(profile.wardNo);
  const district = profile.districtName;

  return {
    operator_name: profile.operatorName,
    district_name: district,
    current_district_name: district,
    applicant_district: district,
    current_district: district,
    current_applicant_district: district,
    current_applicant_district_name: district,
    जिल्ला: district,
    जिल्लाको_नाम: district,
    जिल्ला_नाम: district,
    हालको_जिल्ला: district,
    निवेदकको_जिल्ला: district,
    ward_no: wardNoNe,
    current_ward_no: wardNoNe,
    applicant_ward_no: wardNoNe,
    applicant_ward: wardNoNe,
    current_applicant_ward_no: wardNoNe,
    current_applicant_ward: wardNoNe,
    वडा: wardNoNe,
    वडा_नं: wardNoNe,
    वडा_नम्बर: wardNoNe,
    हालको_वडा_नं: wardNoNe,
    निवेदकको_वडा_नं: wardNoNe,
    निवेदकको_वडा_नम्बर: wardNoNe,
    local_body_type: bodyType,
    local_body_name: localLevel,
    current_local_body_type: bodyType,
    current_local_body_name: localLevel,
    applicant_local_level: localLevel,
    local_level: localLevel,
    current_local_level: localLevel,
    current_applicant_local_level: localLevel,
    current_applicant_local_body: localLevel,
    current_applicant_local_body_name: localLevel,
    current_applicant_local_body_type: bodyType,
    स्थानीय_तह: localLevel,
    स्थानीयतह: localLevel,
    हालको_स्थानीय_तह: localLevel,
    निवेदकको_स्थानीय_तह: localLevel,
    नगरपालिका: localLevel,
    गाउँपालिका: localLevel,
    गाउपालिका: localLevel,
    महानगरपालिका: localLevel,
    नगरपालिका_वा_गाउँपालिका: localLevel,
    गाउँपालिका_वा_नगरपालिका: localLevel,
    former_local_body_type: formerBodyType,
    former_local_body_name: profile.formerLocalBodyName,
    former_ward_no: toDevanagariDigits(profile.formerWardNo),
    former_address: formatWardFormerAddress(profile),
    साविक_ठेगाना: formatWardFormerAddress(profile),
    साविकको_ठेगाना: formatWardFormerAddress(profile),
    पूर्व_ठेगाना: formatWardFormerAddress(profile),
    today: todayNe,
    date: todayNe,
    miti: todayNe,
    मिति: todayNe,
    आजको_मिति: todayNe,
    आवेदन_मिति: todayNe,
    application_date: todayNe,
    current_address: formatWardCurrentAddress(profile),
    हालको_ठेगाना: formatWardCurrentAddress(profile),
    निवेदकको_ठेगाना: formatWardCurrentAddress(profile),
    applicant_address: formatWardCurrentAddress(profile),
  };
}

export function buildInitialWardDocumentValues(
  profile: WardOperatorProfile,
  userFields: WardTemplateVariable[],
  extraKeys: string[] = []
): Record<string, string> {
  const base = buildWardProfileVariables(profile);
  const keys = [
    ...userFields.map((variable) => variable.key),
    ...extraKeys,
  ];
  for (const key of keys) {
    if (base[key]?.trim()) continue;
    const fromProfile = wardProfileValueForKey(profile, key);
    if (fromProfile?.trim()) {
      base[key] = fromProfile;
    } else if (base[key] === undefined) {
      base[key] = "";
    }
  }
  return base;
}
