import {
  type BsDate,
  bsToAd,
  clampBsDate,
  daysBetweenAd,
  getAshadEndBs,
  getDaysInBsMonth,
  getFyEndAshadYear,
  getTodayBs,
  isValidBsDate,
} from "@/lib/nepaliCalendar";

/** Bagmati Province rates — FY 2083/84 (ref: hemsguide.com/vehicle-tax-rate-in-nepal) */
export const VEHICLE_TAX_FY = "2083/84";

export type VehicleType = "motorcycle" | "car" | "ev_bike" | "ev_car";

export type PaymentStatusKey =
  | "on_time"
  | "days_1_30"
  | "days_31_45"
  | "same_fy"
  | "year_1"
  | "year_2"
  | "year_3";

export interface VehicleTaxInput {
  vehicleType: VehicleType;
  capacity: number;
  lastRenewal?: BsDate | null;
  paymentStatus?: PaymentStatusKey;
}

export interface TaxSlabDefinition {
  id: string;
  min: number;
  max: number;
  tax: number;
}

export interface MatchedTaxSlab extends TaxSlabDefinition {
  vehicleType: VehicleType;
}

export interface VehicleTaxBreakdown {
  annualTax: number;
  renewalCharge: number;
  insurance: number;
  taxYears: number;
  totalTax: number;
  lateFineRate: number;
  lateFine: number;
  totalCost: number;
  paymentStatusKey: PaymentStatusKey;
  paymentStatusLabelKey: PaymentStatusKey;
  nextDueBs: BsDate | null;
  daysLate: number;
  autoFromRenewal: boolean;
  matchedSlab: MatchedTaxSlab;
}

interface TaxSlab {
  max: number;
  tax: number;
  id: string;
}

const RENEWAL_MOTOR = 300;
const RENEWAL_FOUR = 500;

/** FY 2083/84 Bagmati Province — motorcycles & scooters (CC) */
const MOTORCYCLE_TAX: TaxSlab[] = [
  { id: "m125", max: 125, tax: 3_000 },
  { id: "m150", max: 150, tax: 5_000 },
  { id: "m225", max: 225, tax: 6_500 },
  { id: "m400", max: 400, tax: 11_000 },
  { id: "m650", max: 650, tax: 20_000 },
  { id: "m651", max: Infinity, tax: 30_000 },
];

/** FY 2083/84 — private cars, jeeps & vans (petrol/diesel, CC) */
const CAR_TAX: TaxSlab[] = [
  { id: "c1000", max: 1_000, tax: 22_000 },
  { id: "c1500", max: 1_500, tax: 25_000 },
  { id: "c2000", max: 2_000, tax: 27_000 },
  { id: "c2500", max: 2_500, tax: 37_000 },
  { id: "c2900", max: 2_900, tax: 50_000 },
  { id: "c2901", max: Infinity, tax: 65_000 },
];

/** FY 2083/84 — electric two-wheelers (Watts) */
const EV_BIKE_TAX: TaxSlab[] = [
  { id: "eb1000", max: 1_000, tax: 1_500 },
  { id: "eb1500", max: 1_500, tax: 2_000 },
  { id: "eb1501", max: Infinity, tax: 3_000 },
];

/** FY 2083/84 — electric cars, jeeps & vans (kW) */
const EV_CAR_TAX: TaxSlab[] = [
  { id: "e49", max: 49, tax: 10_000 },
  { id: "e125", max: 125, tax: 15_000 },
  { id: "e225", max: 225, tax: 20_000 },
  { id: "e226", max: Infinity, tax: 30_000 },
];

const MOTORCYCLE_INSURANCE: TaxSlab[] = [
  { id: "m125", max: 125, tax: 1_415 },
  { id: "m150", max: 150, tax: 1_715 },
  { id: "m225", max: 225, tax: 2_015 },
  { id: "m400", max: 400, tax: 3_500 },
  { id: "m650", max: 650, tax: 5_500 },
  { id: "m651", max: Infinity, tax: 7_500 },
];

const CAR_INSURANCE: TaxSlab[] = [
  { id: "c1000", max: 1_000, tax: 6_500 },
  { id: "c1500", max: 1_500, tax: 8_500 },
  { id: "c2000", max: 2_000, tax: 10_500 },
  { id: "c2500", max: 2_500, tax: 14_000 },
  { id: "c2900", max: 2_900, tax: 18_000 },
  { id: "c2901", max: Infinity, tax: 25_000 },
];

const EV_BIKE_INSURANCE: TaxSlab[] = [
  { id: "eb1000", max: 1_000, tax: 800 },
  { id: "eb1500", max: 1_500, tax: 1_200 },
  { id: "eb1501", max: Infinity, tax: 1_500 },
];

const EV_CAR_INSURANCE: TaxSlab[] = [
  { id: "e49", max: 49, tax: 4_000 },
  { id: "e125", max: 125, tax: 8_000 },
  { id: "e225", max: 225, tax: 10_000 },
  { id: "e226", max: Infinity, tax: 12_000 },
];

const TAX_BY_TYPE: Record<VehicleType, TaxSlab[]> = {
  motorcycle: MOTORCYCLE_TAX,
  car: CAR_TAX,
  ev_bike: EV_BIKE_TAX,
  ev_car: EV_CAR_TAX,
};

const INSURANCE_BY_TYPE: Record<VehicleType, TaxSlab[]> = {
  motorcycle: MOTORCYCLE_INSURANCE,
  car: CAR_INSURANCE,
  ev_bike: EV_BIKE_INSURANCE,
  ev_car: EV_CAR_INSURANCE,
};

const FINE_RATES: Record<PaymentStatusKey, number> = {
  on_time: 0,
  days_1_30: 0.05,
  days_31_45: 0.1,
  same_fy: 0.2,
  year_1: 0.32,
  year_2: 0.64,
  year_3: 0.96,
};

function findSlab(slabs: TaxSlab[], capacity: number): TaxSlab {
  return slabs.find((s) => capacity <= s.max) ?? slabs[slabs.length - 1];
}

function slabToDefinition(slabs: TaxSlab[], slab: TaxSlab, index: number): TaxSlabDefinition {
  const min = index === 0 ? 0 : slabs[index - 1].max + 1;
  const max = Number.isFinite(slab.max) ? slab.max : slab.max;
  return { id: slab.id, min, max: slab.max, tax: slab.tax };
}

export function getTaxSlabsForType(vehicleType: VehicleType): TaxSlabDefinition[] {
  const slabs = TAX_BY_TYPE[vehicleType];
  return slabs.map((slab, index) => slabToDefinition(slabs, slab, index));
}

export function getMatchedTaxSlab(
  vehicleType: VehicleType,
  capacity: number
): MatchedTaxSlab | null {
  if (capacity <= 0) return null;
  const slabs = TAX_BY_TYPE[vehicleType];
  const slab = findSlab(slabs, capacity);
  const index = slabs.indexOf(slab);
  return {
    vehicleType,
    ...slabToDefinition(slabs, slab, index),
  };
}

function lookupSlabTax(slabs: TaxSlab[], capacity: number): number {
  return findSlab(slabs, capacity).tax;
}

export function getCapacityLimits(vehicleType: VehicleType): { min: number; max: number } {
  switch (vehicleType) {
    case "motorcycle":
      return { min: 50, max: 2_000 };
    case "car":
      return { min: 600, max: 6_000 };
    case "ev_bike":
      return { min: 10, max: 10_000 };
    case "ev_car":
      return { min: 5, max: 500 };
  }
}

export function getCapacitySliderStep(vehicleType: VehicleType): number {
  switch (vehicleType) {
    case "motorcycle":
      return 1;
    case "car":
      return 50;
    case "ev_bike":
      return 10;
    case "ev_car":
      return 5;
  }
}

export function getCapacityRange(
  vehicleType: VehicleType,
  _capacity?: number
): { min: number; max: number; step: number } {
  const { min, max } = getCapacityLimits(vehicleType);
  return { min, max, step: getCapacitySliderStep(vehicleType) };
}

export function getAnnualTax(vehicleType: VehicleType, capacity: number): number {
  return lookupSlabTax(TAX_BY_TYPE[vehicleType], capacity);
}

export function getRenewalCharge(vehicleType: VehicleType): number {
  return vehicleType === "motorcycle" || vehicleType === "ev_bike"
    ? RENEWAL_MOTOR
    : RENEWAL_FOUR;
}

export function getInsurance(vehicleType: VehicleType, capacity: number): number {
  return lookupSlabTax(INSURANCE_BY_TYPE[vehicleType], capacity);
}

/** Derive lateness from last bluebook renewal (BS) to today. */
export function derivePaymentStatusFromRenewal(lastRenewal: BsDate): {
  status: PaymentStatusKey;
  taxYears: number;
  daysLate: number;
  nextDueBs: BsDate;
} {
  const today = new Date();
  const lastPaidFyEnd = getFyEndAshadYear(lastRenewal.year, lastRenewal.month);
  let dueAshadYear = lastPaidFyEnd + 1;
  let taxYears = 0;
  let firstMissedDue: Date | null = null;

  while (true) {
    const dueBs = getAshadEndBs(dueAshadYear);
    const dueAd = bsToAd(dueBs);
    if (today.getTime() <= dueAd.getTime()) break;
    if (!firstMissedDue) firstMissedDue = dueAd;
    taxYears += 1;
    dueAshadYear += 1;
    if (taxYears >= 5) break;
  }

  if (taxYears === 0) {
    return {
      status: "on_time",
      taxYears: 1,
      daysLate: 0,
      nextDueBs: getAshadEndBs(lastPaidFyEnd + 1),
    };
  }

  const daysLate = firstMissedDue ? Math.max(0, daysBetweenAd(firstMissedDue, today)) : 0;

  let status: PaymentStatusKey;
  if (taxYears >= 3) {
    status = "year_3";
  } else if (taxYears === 2) {
    status = "year_2";
  } else if (taxYears === 1) {
    if (daysLate <= 30) status = "days_1_30";
    else if (daysLate <= 45) status = "days_31_45";
    else status = "same_fy";
  } else {
    status = "on_time";
  }

  if (taxYears >= 2) {
    status = taxYears >= 3 ? "year_3" : "year_2";
  } else if (taxYears === 1 && daysLate > 45) {
    status = "same_fy";
  }

  return {
    status,
    taxYears: Math.max(taxYears, 1),
    daysLate,
    nextDueBs: getAshadEndBs(lastPaidFyEnd + 1),
  };
}

export function calculateVehicleTax(input: VehicleTaxInput): VehicleTaxBreakdown | null {
  const capacity = Math.max(0, input.capacity);
  const matchedSlab = getMatchedTaxSlab(input.vehicleType, capacity);
  if (!matchedSlab) return null;

  const annualTax = matchedSlab.tax;
  const renewalCharge = getRenewalCharge(input.vehicleType);
  const insurance = getInsurance(input.vehicleType, capacity);

  let paymentStatusKey: PaymentStatusKey = input.paymentStatus ?? "on_time";
  let taxYears = 1;
  let daysLate = 0;
  let nextDueBs: BsDate | null = null;
  let autoFromRenewal = false;

  if (input.lastRenewal && isValidBsDate(input.lastRenewal)) {
    const lastRenewal = clampBsDate(input.lastRenewal, getTodayBs());
    const derived = derivePaymentStatusFromRenewal(lastRenewal);
    paymentStatusKey = derived.status;
    taxYears = derived.taxYears;
    daysLate = derived.daysLate;
    nextDueBs = derived.nextDueBs;
    autoFromRenewal = true;
  }

  const totalTax = annualTax * taxYears;
  const lateFineRate = FINE_RATES[paymentStatusKey];
  const lateFine = Math.round(totalTax * lateFineRate);
  const totalCost = totalTax + renewalCharge + insurance + lateFine;

  return {
    annualTax,
    renewalCharge,
    insurance,
    taxYears,
    totalTax,
    lateFineRate,
    lateFine,
    totalCost,
    paymentStatusKey,
    paymentStatusLabelKey: paymentStatusKey,
    nextDueBs,
    daysLate,
    autoFromRenewal,
    matchedSlab,
  };
}

export function getDefaultLastRenewalBs(): BsDate {
  const today = getTodayBs();
  const year = today.year - 1;
  const day = Math.min(today.day, getDaysInBsMonth(year, today.month));
  return { year, month: today.month, day };
}

export const PAYMENT_STATUS_OPTIONS: PaymentStatusKey[] = [
  "on_time",
  "days_1_30",
  "days_31_45",
  "same_fy",
  "year_1",
  "year_2",
  "year_3",
];

export function formatFineRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
