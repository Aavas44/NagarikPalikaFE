export type CalculatorIconColor = "blue" | "green" | "amber" | "teal";

export const CALCULATOR_ITEMS = [
  {
    slug: "salary-tax",
    labelKey: "salaryTax",
    descriptionKey: "salaryTaxDesc",
    icon: "💰",
    iconColor: "blue",
    available: true,
  },
  {
    slug: "emi",
    labelKey: "emi",
    descriptionKey: "emiDesc",
    icon: "🏦",
    iconColor: "teal",
    available: true,
  },
  {
    slug: "land-converter",
    labelKey: "landConverter",
    descriptionKey: "landConverterDesc",
    icon: "📐",
    iconColor: "green",
    available: true,
  },
  {
    slug: "land-registration-tax",
    labelKey: "landRegistrationTax",
    descriptionKey: "landRegistrationTaxDesc",
    icon: "🏠",
    iconColor: "amber",
    available: false,
  },
  {
    slug: "capital-gains",
    labelKey: "capitalGains",
    descriptionKey: "capitalGainsDesc",
    icon: "📈",
    iconColor: "green",
    available: false,
  },
  {
    slug: "vehicle-tax",
    labelKey: "vehicleTax",
    descriptionKey: "vehicleTaxDesc",
    icon: "🚗",
    iconColor: "amber",
    available: true,
  },
] as const;

export type CalculatorSlug = (typeof CALCULATOR_ITEMS)[number]["slug"];

export const FEATURED_CALCULATOR_SLUG: CalculatorSlug = "salary-tax";
export type CalculatorLabelKey = (typeof CALCULATOR_ITEMS)[number]["labelKey"];
export type CalculatorDescriptionKey = (typeof CALCULATOR_ITEMS)[number]["descriptionKey"];

export function isCalculatorSlug(slug: string): slug is CalculatorSlug {
  return CALCULATOR_ITEMS.some((item) => item.slug === slug);
}

export function getCalculatorCount(): number {
  return CALCULATOR_ITEMS.length;
}
