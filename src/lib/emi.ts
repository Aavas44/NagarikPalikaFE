export interface AmortizationPoint {
  label: string;
  principal: number;
  interest: number;
  emi: number;
  balance: number;
}

export function buildAmortizationSchedule(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): AmortizationPoint[] {
  if (principal <= 0 || tenureMonths <= 0) return [];

  const emiResult = calculateEmi(principal, annualRatePercent, tenureMonths);
  if (!emiResult) return [];

  const emi = emiResult.emi;
  const monthlyRate = annualRatePercent / 12 / 100;
  let balance = principal;

  const monthly: AmortizationPoint[] = [];

  for (let m = 1; m <= tenureMonths; m++) {
    const interest = annualRatePercent === 0 ? 0 : balance * monthlyRate;
    const principalPaid = Math.min(emi - interest, balance);
    balance = Math.max(0, balance - principalPaid);

    monthly.push({
      label: String(m),
      principal: principalPaid,
      interest,
      emi,
      balance,
    });
  }

  if (tenureMonths <= 36) {
    return monthly;
  }

  const yearly: AmortizationPoint[] = [];
  for (let y = 0; y < monthly.length; y += 12) {
    const chunk = monthly.slice(y, y + 12);
    const yearIndex = Math.floor(y / 12) + 1;
    yearly.push({
      label: String(yearIndex),
      principal: chunk.reduce((s, p) => s + p.principal, 0),
      interest: chunk.reduce((s, p) => s + p.interest, 0),
      emi: chunk.reduce((s, p) => s + p.emi, 0),
      balance: chunk[chunk.length - 1]?.balance ?? 0,
    });
  }

  return yearly;
}

export function calculateEmi(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number
): { emi: number; totalPayment: number; totalInterest: number } | null {
  if (principal <= 0 || tenureMonths <= 0 || annualRatePercent < 0) {
    return null;
  }

  if (annualRatePercent === 0) {
    const emi = principal / tenureMonths;
    return {
      emi,
      totalPayment: principal,
      totalInterest: 0,
    };
  }

  const monthlyRate = annualRatePercent / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return {
    emi,
    totalPayment: emi * tenureMonths,
    totalInterest: emi * tenureMonths - principal,
  };
}

export function formatNpr(amount: number): string {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}
