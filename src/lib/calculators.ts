export const CALCULATOR_ITEMS = [
  { slug: "salary-tax", labelKey: "salaryTax" },
  { slug: "capital-gains", labelKey: "capitalGains" },
  { slug: "vehicle-tax", labelKey: "vehicleTax" },
  { slug: "land-registration-tax", labelKey: "landRegistrationTax" },
  { slug: "emi", labelKey: "emi" },
  { slug: "land-converter", labelKey: "landConverter" },
] as const;

export type CalculatorSlug = (typeof CALCULATOR_ITEMS)[number]["slug"];
export type CalculatorLabelKey = (typeof CALCULATOR_ITEMS)[number]["labelKey"];

export function isCalculatorSlug(slug: string): slug is CalculatorSlug {
  return CALCULATOR_ITEMS.some((item) => item.slug === slug);
}
