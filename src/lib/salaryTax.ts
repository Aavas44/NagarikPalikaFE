export type MaritalStatus = "unmarried" | "married";
export type FiscalYear = "2083-84" | "2082-83";

export interface SalaryTaxInput {
  fiscalYear: FiscalYear;
  maritalStatus: MaritalStatus;
  isSsfContributor: boolean;
  isFemale: boolean;
  monthlySalary: number;
  months: number;
  bonus: number;
  ssf: number;
  epf: number;
  cit: number;
  lifeInsurance: number;
  medicalInsurance: number;
}

export interface TaxSlabBreakdown {
  label: string;
  rate: number;
  taxableAmount: number;
  tax: number;
  waived?: boolean;
}

export interface SalaryTaxResult {
  totalIncome: number;
  appliedRetirement: number;
  appliedLifeInsurance: number;
  appliedMedicalInsurance: number;
  totalDeduction: number;
  netAssessable: number;
  grossTax: number;
  femaleRebate: number;
  netTax: number;
  monthlyTax: number;
  slabs: TaxSlabBreakdown[];
}

const LIFE_INSURANCE_CAP = 40_000;
const MEDICAL_INSURANCE_CAP = 20_000;

const SLABS_2083_84 = [
  { upTo: 1_000_000, rate: 0.01, isSst: true },
  { upTo: 1_500_000, rate: 0.1 },
  { upTo: 2_500_000, rate: 0.2 },
  { upTo: 4_000_000, rate: 0.27 },
  { upTo: Infinity, rate: 0.29 },
];

const SLABS_2082_83_INDIVIDUAL = [
  { upTo: 500_000, rate: 0.01, isSst: true },
  { upTo: 700_000, rate: 0.1 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.3 },
  { upTo: 5_000_000, rate: 0.36 },
  { upTo: Infinity, rate: 0.39 },
];

const SLABS_2082_83_COUPLE = [
  { upTo: 600_000, rate: 0.01, isSst: true },
  { upTo: 800_000, rate: 0.1 },
  { upTo: 1_100_000, rate: 0.2 },
  { upTo: 2_100_000, rate: 0.3 },
  { upTo: 5_100_000, rate: 0.36 },
  { upTo: Infinity, rate: 0.39 },
];

function formatSlabRange(from: number, to: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-NP", { maximumFractionDigits: 0 }).format(Math.round(n));
  if (!Number.isFinite(to)) return `${fmt(from + 1)}+`;
  return `${fmt(from + 1)} – ${fmt(to)}`;
}

function calculateSlabTax(
  taxableIncome: number,
  slabs: { upTo: number; rate: number; isSst?: boolean }[],
  waiveSst: boolean
): { tax: number; slabs: TaxSlabBreakdown[] } {
  if (taxableIncome <= 0) return { tax: 0, slabs: [] };

  let remaining = taxableIncome;
  let prevLimit = 0;
  let totalTax = 0;
  const breakdown: TaxSlabBreakdown[] = [];

  for (const slab of slabs) {
    const slabWidth = slab.upTo === Infinity ? remaining : slab.upTo - prevLimit;
    const taxableInSlab = Math.min(Math.max(remaining, 0), slabWidth);
    if (taxableInSlab <= 0) {
      prevLimit = slab.upTo;
      continue;
    }

    const waived = Boolean(slab.isSst && waiveSst);
    const slabTax = waived ? 0 : taxableInSlab * slab.rate;
    totalTax += slabTax;

    breakdown.push({
      label: formatSlabRange(prevLimit, slab.upTo),
      rate: slab.rate,
      taxableAmount: taxableInSlab,
      tax: slabTax,
      waived,
    });

    remaining -= taxableInSlab;
    prevLimit = slab.upTo;
    if (remaining <= 0) break;
  }

  return { tax: totalTax, slabs: breakdown };
}

export function calculateSalaryTax(input: SalaryTaxInput): SalaryTaxResult {
  const totalIncome = Math.max(0, input.monthlySalary * input.months + input.bonus);

  const retirementCap = input.isSsfContributor ? 500_000 : 300_000;
  const retirementLimit = Math.min(retirementCap, totalIncome / 3);
  const appliedRetirement = Math.min(
    Math.max(0, input.ssf) + Math.max(0, input.epf) + Math.max(0, input.cit),
    retirementLimit
  );

  const appliedLifeInsurance = Math.min(Math.max(0, input.lifeInsurance), LIFE_INSURANCE_CAP);
  const appliedMedicalInsurance = Math.min(
    Math.max(0, input.medicalInsurance),
    MEDICAL_INSURANCE_CAP
  );
  const totalDeduction = appliedRetirement + appliedLifeInsurance + appliedMedicalInsurance;
  const netAssessable = Math.max(0, totalIncome - totalDeduction);

  const slabs =
    input.fiscalYear === "2083-84"
      ? SLABS_2083_84
      : input.maritalStatus === "married"
        ? SLABS_2082_83_COUPLE
        : SLABS_2082_83_INDIVIDUAL;

  const { tax: grossTax, slabs: slabBreakdown } = calculateSlabTax(
    netAssessable,
    slabs,
    input.isSsfContributor
  );

  const femaleRebate =
    input.isFemale && input.maritalStatus === "unmarried" ? grossTax * 0.1 : 0;
  const netTax = Math.max(0, grossTax - femaleRebate);
  const monthCount = input.months > 0 ? input.months : 12;
  const monthlyTax = netTax / monthCount;

  return {
    totalIncome,
    appliedRetirement,
    appliedLifeInsurance,
    appliedMedicalInsurance,
    totalDeduction,
    netAssessable,
    grossTax,
    femaleRebate,
    netTax,
    monthlyTax,
    slabs: slabBreakdown,
  };
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
