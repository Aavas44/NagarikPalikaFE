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
  { key: "current_address", label: "हालको ठेगाना (Current address)" },
  { key: "current_district_name", label: "हालको जिल्ला (Current district name)" },
  { key: "current_applicant_local_level", label: "हालको स्थानीय तह (Current applicant local level)" },
  { key: "current_applicant_ward_no", label: "हालको वडा नं. (Current applicant ward no.)" },
  { key: "district_name", label: "जिल्ला (District)" },
  { key: "local_body_name", label: "स्थानीय तह (Local level)" },
  { key: "local_body_type", label: "स्थानीय तहको प्रकार (Local body type)" },
  { key: "ward_no", label: "वडा नं. (Ward no.)" },
  { key: "operator_name", label: "सञ्चालकको नाम (Operator name)" },
  { key: "former_local_body_type", label: "पूर्व स्थानीय तहको प्रकार (Former local body type)" },
  { key: "former_local_body_name", label: "पूर्व स्थानीय तह (Former local body)" },
  { key: "former_ward_no", label: "पूर्व वडा नं. (Former ward no.)" },
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

export function formatWardCurrentAddress(profile: WardOperatorProfile): string {
  const bodyType =
    LOCAL_BODY_LABELS_NE[profile.localBodyType] ?? profile.localBodyType;
  return `वडा नं. ${toDevanagariDigits(profile.wardNo)}, ${bodyType} ${profile.localBodyName}, ${profile.districtName}`;
}

export function buildWardProfileVariables(
  profile: WardOperatorProfile
): Record<string, string> {
  const bodyType =
    LOCAL_BODY_LABELS_NE[profile.localBodyType] ?? profile.localBodyType;
  const formerBodyType =
    LOCAL_BODY_LABELS_NE[profile.formerLocalBodyType] ??
    profile.formerLocalBodyType;
  const todayNe = formatTodayBsLongNe();
  const dateNe = formatTodayBsShortNe();
  const wardNoNe = toDevanagariDigits(profile.wardNo);

  return {
    operator_name: profile.operatorName,
    district_name: profile.districtName,
    current_district_name: profile.districtName,
    applicant_district: profile.districtName,
    current_district: profile.districtName,
    current_applicant_district: profile.districtName,
    current_applicant_district_name: profile.districtName,
    ward_no: wardNoNe,
    current_ward_no: wardNoNe,
    applicant_ward_no: wardNoNe,
    applicant_ward: wardNoNe,
    current_applicant_ward_no: wardNoNe,
    current_applicant_ward: wardNoNe,
    local_body_type: bodyType,
    local_body_name: profile.localBodyName,
    current_local_body_type: bodyType,
    current_local_body_name: profile.localBodyName,
    applicant_local_level: profile.localBodyName,
    local_level: profile.localBodyName,
    current_local_level: profile.localBodyName,
    current_applicant_local_level: profile.localBodyName,
    current_applicant_local_body: profile.localBodyName,
    current_applicant_local_body_name: profile.localBodyName,
    current_applicant_local_body_type: bodyType,
    former_local_body_type: formerBodyType,
    former_local_body_name: profile.formerLocalBodyName,
    former_ward_no: toDevanagariDigits(profile.formerWardNo),
    today: todayNe,
    date: dateNe,
    miti: todayNe,
    application_date: todayNe,
    current_address: formatWardCurrentAddress(profile),
  };
}

export function buildInitialWardDocumentValues(
  profile: WardOperatorProfile,
  userFields: WardTemplateVariable[]
): Record<string, string> {
  const base = buildWardProfileVariables(profile);
  for (const variable of userFields) {
    if (base[variable.key] === undefined) {
      base[variable.key] = "";
    }
  }
  return base;
}
