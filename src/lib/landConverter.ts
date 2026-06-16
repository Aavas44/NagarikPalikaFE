export type LandSystem = "hill" | "terai";

export interface HillUnits {
  ropani: number;
  anna: number;
  paisa: number;
  daam: number;
}

export interface TeraiUnits {
  bigha: number;
  kattha: number;
  dhur: number;
}

export interface UnitBreakdownRow {
  unitKey: string;
  quantity: number;
  sqMPerUnit: number;
  sqMContribution: number;
}

export interface LandConversionResult {
  sqM: number;
  sqFt: number;
  hill: HillUnits;
  terai: TeraiUnits;
  breakdown: UnitBreakdownRow[];
  crossSystemNote: string;
}

/** National standard — square metres per unit */
export const SQ_M_PER_ROPANI = 508.7374778;
export const SQ_M_PER_ANNA = 31.7960924;
export const SQ_M_PER_PAISA = 7.9490231;
export const SQ_M_PER_DAAM = 1.9872558;
export const SQ_M_PER_BIGHA = 6772.6315789;
export const SQ_M_PER_KATTHA = 338.6315789;
export const SQ_M_PER_DHUR = 16.9315789;

export const SQ_FT_PER_SQ_M = 10.7639104167;

export const HILL_LIMITS = { anna: 15, paisa: 3, daam: 3 } as const;
export const TERAI_LIMITS = { kattha: 19, dhur: 19 } as const;

const EMPTY_HILL: HillUnits = { ropani: 0, anna: 0, paisa: 0, daam: 0 };
const EMPTY_TERAI: TeraiUnits = { bigha: 0, kattha: 0, dhur: 0 };

function clampNonNegative(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function hillToSqM(units: HillUnits): number {
  return (
    clampNonNegative(units.ropani) * SQ_M_PER_ROPANI +
    clampNonNegative(units.anna) * SQ_M_PER_ANNA +
    clampNonNegative(units.paisa) * SQ_M_PER_PAISA +
    clampNonNegative(units.daam) * SQ_M_PER_DAAM
  );
}

export function teraiToSqM(units: TeraiUnits): number {
  return (
    clampNonNegative(units.bigha) * SQ_M_PER_BIGHA +
    clampNonNegative(units.kattha) * SQ_M_PER_KATTHA +
    clampNonNegative(units.dhur) * SQ_M_PER_DHUR
  );
}

export function sqMToSqFt(sqM: number): number {
  return sqM * SQ_FT_PER_SQ_M;
}

export function sqMToHill(sqM: number): HillUnits {
  if (sqM <= 0) return { ...EMPTY_HILL };

  let remainingDaam = Math.round(sqM / SQ_M_PER_DAAM);
  const ropani = Math.floor(remainingDaam / 256);
  remainingDaam %= 256;
  const anna = Math.floor(remainingDaam / 16);
  remainingDaam %= 16;
  const paisa = Math.floor(remainingDaam / 4);
  const daam = remainingDaam % 4;

  return { ropani, anna, paisa, daam };
}

export function sqMToTerai(sqM: number): TeraiUnits {
  if (sqM <= 0) return { ...EMPTY_TERAI };

  let remainingDhur = Math.round(sqM / SQ_M_PER_DHUR);
  const bigha = Math.floor(remainingDhur / 400);
  remainingDhur %= 400;
  const kattha = Math.floor(remainingDhur / 20);
  const dhur = remainingDhur % 20;

  return { bigha, kattha, dhur };
}

export function formatHillNotation(units: HillUnits): string {
  return `${units.ropani}-${units.anna}-${units.paisa}-${units.daam}`;
}

export function formatTeraiNotation(units: TeraiUnits): string {
  return `${units.bigha}-${units.kattha}-${units.dhur}`;
}

export interface LandUnitLabels {
  ropani: string;
  anna: string;
  paisa: string;
  daam: string;
  bigha: string;
  kattha: string;
  dhur: string;
}

export function formatHillVerbose(units: HillUnits, labels: LandUnitLabels): string {
  return [
    `${units.ropani} ${labels.ropani}`,
    `${units.anna} ${labels.anna}`,
    `${units.paisa} ${labels.paisa}`,
    `${units.daam} ${labels.daam}`,
  ].join(" - ");
}

export function formatTeraiVerbose(units: TeraiUnits, labels: LandUnitLabels): string {
  return [
    `${units.bigha} ${labels.bigha}`,
    `${units.kattha} ${labels.kattha}`,
    `${units.dhur} ${labels.dhur}`,
  ].join(" - ");
}

export function formatSqM(sqM: number, decimals = 2): string {
  return sqM.toLocaleString("en-NP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatSqFt(sqFt: number, decimals = 0): string {
  return Math.round(sqFt).toLocaleString("en-NP");
}

export function getHillValidationWarnings(units: HillUnits): string[] {
  const warnings: string[] = [];
  if (units.anna > HILL_LIMITS.anna) warnings.push("anna");
  if (units.paisa > HILL_LIMITS.paisa) warnings.push("paisa");
  if (units.daam > HILL_LIMITS.daam) warnings.push("daam");
  return warnings;
}

export function getTeraiValidationWarnings(units: TeraiUnits): string[] {
  const warnings: string[] = [];
  if (units.kattha > TERAI_LIMITS.kattha) warnings.push("kattha");
  if (units.dhur > TERAI_LIMITS.dhur) warnings.push("dhur");
  return warnings;
}

function buildHillBreakdown(units: HillUnits): UnitBreakdownRow[] {
  const rows: UnitBreakdownRow[] = [];
  if (units.ropani > 0) {
    rows.push({
      unitKey: "ropani",
      quantity: units.ropani,
      sqMPerUnit: SQ_M_PER_ROPANI,
      sqMContribution: units.ropani * SQ_M_PER_ROPANI,
    });
  }
  if (units.anna > 0) {
    rows.push({
      unitKey: "anna",
      quantity: units.anna,
      sqMPerUnit: SQ_M_PER_ANNA,
      sqMContribution: units.anna * SQ_M_PER_ANNA,
    });
  }
  if (units.paisa > 0) {
    rows.push({
      unitKey: "paisa",
      quantity: units.paisa,
      sqMPerUnit: SQ_M_PER_PAISA,
      sqMContribution: units.paisa * SQ_M_PER_PAISA,
    });
  }
  if (units.daam > 0) {
    rows.push({
      unitKey: "daam",
      quantity: units.daam,
      sqMPerUnit: SQ_M_PER_DAAM,
      sqMContribution: units.daam * SQ_M_PER_DAAM,
    });
  }
  return rows;
}

function buildTeraiBreakdown(units: TeraiUnits): UnitBreakdownRow[] {
  const rows: UnitBreakdownRow[] = [];
  if (units.bigha > 0) {
    rows.push({
      unitKey: "bigha",
      quantity: units.bigha,
      sqMPerUnit: SQ_M_PER_BIGHA,
      sqMContribution: units.bigha * SQ_M_PER_BIGHA,
    });
  }
  if (units.kattha > 0) {
    rows.push({
      unitKey: "kattha",
      quantity: units.kattha,
      sqMPerUnit: SQ_M_PER_KATTHA,
      sqMContribution: units.kattha * SQ_M_PER_KATTHA,
    });
  }
  if (units.dhur > 0) {
    rows.push({
      unitKey: "dhur",
      quantity: units.dhur,
      sqMPerUnit: SQ_M_PER_DHUR,
      sqMContribution: units.dhur * SQ_M_PER_DHUR,
    });
  }
  return rows;
}

export function convertLand(
  system: LandSystem,
  units: HillUnits | TeraiUnits,
  sqMOverride?: number | null
): LandConversionResult {
  const sqM =
    sqMOverride != null && Number.isFinite(sqMOverride) && sqMOverride >= 0
      ? sqMOverride
      : system === "hill"
        ? hillToSqM(units as HillUnits)
        : teraiToSqM(units as TeraiUnits);

  const hill = sqMToHill(sqM);
  const terai = sqMToTerai(sqM);

  const useMetricBreakdown =
    sqMOverride != null && Number.isFinite(sqMOverride) && sqMOverride >= 0;
  const breakdown =
    system === "hill"
      ? buildHillBreakdown(useMetricBreakdown ? hill : (units as HillUnits))
      : buildTeraiBreakdown(useMetricBreakdown ? terai : (units as TeraiUnits));

  return {
    sqM,
    sqFt: sqMToSqFt(sqM),
    hill,
    terai,
    breakdown,
    crossSystemNote: `1 Bigha ≈ 13 Ropani 3 Anna (${formatSqM(SQ_M_PER_BIGHA)} sq m)`,
  };
}

export function buildCopyText(
  system: LandSystem,
  result: LandConversionResult,
  labels: LandUnitLabels & { sqM: string; sqFt: string }
): string {
  const notation =
    system === "hill"
      ? formatHillVerbose(result.hill, labels)
      : formatTeraiVerbose(result.terai, labels);
  return `${notation} (${formatSqM(result.sqM)} ${labels.sqM} / ${formatSqFt(result.sqFt)} ${labels.sqFt})`;
}
