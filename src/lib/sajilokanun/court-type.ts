/** Court tier used for Sajilo Kanun cases and document templates. */

export type CourtType = "district" | "high" | "supreme" | "special";

export const COURT_TYPES: CourtType[] = [
  "district",
  "high",
  "supreme",
  "special",
];

export const COURT_TYPE_META: Record<
  CourtType,
  {
    labelNe: string;
    labelEn: string;
    catalogCategory: "district_courts" | "high_courts" | "special_courts" | null;
  }
> = {
  district: {
    labelNe: "जिल्ला अदालत",
    labelEn: "District Court",
    catalogCategory: "district_courts",
  },
  high: {
    labelNe: "उच्च अदालत",
    labelEn: "High Court",
    catalogCategory: "high_courts",
  },
  supreme: {
    labelNe: "सर्वोच्च अदालत",
    labelEn: "Supreme Court",
    catalogCategory: null,
  },
  special: {
    labelNe: "विशेष अदालत",
    labelEn: "Special Court",
    catalogCategory: "special_courts",
  },
};

export function isCourtType(value: unknown): value is CourtType {
  return (
    value === "district" ||
    value === "high" ||
    value === "supreme" ||
    value === "special"
  );
}

export function courtTypeFromCategory(
  category: string | null | undefined
): CourtType | null {
  if (category === "district_courts") return "district";
  if (category === "high_courts") return "high";
  if (category === "special_courts") return "special";
  return null;
}
