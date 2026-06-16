"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { calculateEmi, buildAmortizationSchedule, formatNpr } from "@/lib/emi";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";
import { EmiAmortizationChart } from "./EmiAmortizationChart";

type TenureUnit = "years" | "months";

const LOAN_MIN = 100_000;
const LOAN_MAX = 50_000_000;
const LOAN_STEP = 50_000;
const RATE_MIN = 1;
const RATE_MAX = 24;
const TENURE_YEARS_MAX = 30;
const TENURE_MONTHS_MAX = 360;

const LOAN_PRESETS = [1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000];

export function EmiCalculator() {
  const { msg } = useLanguage();
  const t = msg.calculators.emiForm;

  const [loanAmount, setLoanAmount] = useState(5_000_000);
  const [interestRate, setInterestRate] = useState(12);
  const [tenureUnit, setTenureUnit] = useState<TenureUnit>("years");
  const [tenureValue, setTenureValue] = useState(20);

  const tenureMonths = useMemo(() => {
    const v = Math.max(0, tenureValue);
    return tenureUnit === "years" ? Math.round(v * 12) : Math.round(v);
  }, [tenureUnit, tenureValue]);

  const tenureYearsDisplay = (tenureMonths / 12).toFixed(1).replace(/\.0$/, "");

  const result = useMemo(() => {
    if (loanAmount <= 0 || tenureMonths <= 0) return null;
    return calculateEmi(loanAmount, interestRate, tenureMonths);
  }, [loanAmount, interestRate, tenureMonths]);

  const amortizationSchedule = useMemo(() => {
    if (loanAmount <= 0 || tenureMonths <= 0) return [];
    return buildAmortizationSchedule(loanAmount, interestRate, tenureMonths);
  }, [loanAmount, interestRate, tenureMonths]);

  const groupChartByYear = tenureMonths > 36;

  const principalShare = result ? (loanAmount / result.totalPayment) * 100 : 0;
  const interestShare = result ? 100 - principalShare : 0;

  function handleTenureUnitChange(unit: TenureUnit) {
    if (unit === tenureUnit) return;
    if (unit === "months") {
      setTenureValue(Math.round(tenureValue * 12));
    } else {
      setTenureValue(Math.round(tenureValue / 12) || 1);
    }
    setTenureUnit(unit);
  }

  const tenureMax = tenureUnit === "years" ? TENURE_YEARS_MAX : TENURE_MONTHS_MAX;
  const tenureStep = tenureUnit === "years" ? 1 : 6;

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← {msg.calculators.back}
        </Link>
        <header className={styles.emiHeader}>
          <h1>{msg.calculators.emi}</h1>
          <p className={pageStyles.calculatorSubtitle}>{t.subtitle}</p>
        </header>

        <div className={styles.emiLayout}>
          <div className={styles.emiPanel}>
            <h2 className={styles.emiPanelTitle}>{t.loanDetails}</h2>

            <div className={styles.emiField}>
              <div className={styles.emiFieldTop}>
                <label htmlFor="loan-amount">{t.loanAmount}</label>
                <span className={styles.emiFieldValue}>{formatNpr(loanAmount)}</span>
              </div>
              <input
                id="loan-amount"
                type="range"
                min={LOAN_MIN}
                max={LOAN_MAX}
                step={LOAN_STEP}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                className={styles.emiRange}
              />
              <input
                type="number"
                min={LOAN_MIN}
                max={LOAN_MAX}
                step={LOAN_STEP}
                value={loanAmount}
                onChange={(e) => setLoanAmount(Math.min(LOAN_MAX, Math.max(0, Number(e.target.value))))}
                className={styles.emiNumberInput}
              />
              <div className={styles.emiPresets}>
                {LOAN_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.emiPreset} ${loanAmount === preset ? styles.emiPresetActive : ""}`}
                    onClick={() => setLoanAmount(preset)}
                  >
                    {formatNpr(preset)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.emiField}>
              <div className={styles.emiFieldTop}>
                <label htmlFor="interest-rate">{t.interestRate}</label>
                <span className={styles.emiFieldValue}>{interestRate}%</span>
              </div>
              <input
                id="interest-rate"
                type="range"
                min={RATE_MIN}
                max={RATE_MAX}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className={styles.emiRange}
              />
              <input
                type="number"
                min={RATE_MIN}
                max={RATE_MAX}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className={styles.emiNumberInput}
              />
            </div>

            <div className={styles.emiField}>
              <div className={styles.emiFieldTop}>
                <label>{t.tenure}</label>
                <div className={styles.emiUnitToggle} role="group" aria-label={t.tenure}>
                  <button
                    type="button"
                    className={tenureUnit === "years" ? styles.emiUnitActive : styles.emiUnitBtn}
                    onClick={() => handleTenureUnitChange("years")}
                  >
                    {t.tenureUnitYears}
                  </button>
                  <button
                    type="button"
                    className={tenureUnit === "months" ? styles.emiUnitActive : styles.emiUnitBtn}
                    onClick={() => handleTenureUnitChange("months")}
                  >
                    {t.tenureUnitMonths}
                  </button>
                </div>
              </div>
              <div className={styles.emiFieldTop}>
                <span className={styles.emiFieldHint}>
                  {tenureUnit === "years"
                    ? t.tenureEquivalentMonths.replace("{months}", String(tenureMonths))
                    : t.tenureEquivalentYears.replace("{years}", tenureYearsDisplay)}
                </span>
                <span className={styles.emiFieldValue}>
                  {tenureValue} {tenureUnit === "years" ? t.tenureUnitYears : t.tenureUnitMonths}
                </span>
              </div>
              <input
                type="range"
                min={tenureUnit === "years" ? 1 : 6}
                max={tenureMax}
                step={tenureStep}
                value={tenureValue}
                onChange={(e) => setTenureValue(Number(e.target.value))}
                className={styles.emiRange}
              />
              <input
                type="number"
                min={tenureUnit === "years" ? 1 : 1}
                max={tenureMax}
                step={1}
                value={tenureValue}
                onChange={(e) =>
                  setTenureValue(Math.min(tenureMax, Math.max(1, Number(e.target.value))))
                }
                className={styles.emiNumberInput}
              />
            </div>
          </div>

          <div className={`${styles.emiPanel} ${styles.emiResultsPanel}`}>
            <h2 className={styles.emiPanelTitle}>{t.results}</h2>

            {result ? (
              <>
                <div className={styles.emiEmiHero}>
                  <span className={styles.emiEmiLabel}>{t.monthlyEmi}</span>
                  <span className={styles.emiEmiAmount}>{formatNpr(result.emi)}</span>
                  <span className={styles.emiEmiSub}>
                    {t.perMonth} · {tenureMonths} {t.tenureUnitMonths}
                  </span>
                </div>

                <div className={styles.emiStatGrid}>
                  <div className={styles.emiStat}>
                    <span className={styles.emiStatLabel}>{t.principal}</span>
                    <span className={styles.emiStatValue}>{formatNpr(loanAmount)}</span>
                  </div>
                  <div className={styles.emiStat}>
                    <span className={styles.emiStatLabel}>{t.totalInterest}</span>
                    <span className={styles.emiStatValue}>{formatNpr(result.totalInterest)}</span>
                  </div>
                  <div className={`${styles.emiStat} ${styles.emiStatFull}`}>
                    <span className={styles.emiStatLabel}>{t.totalPayment}</span>
                    <span className={styles.emiStatValue}>{formatNpr(result.totalPayment)}</span>
                  </div>
                </div>

                <div className={styles.emiBreakdown}>
                  <div className={styles.emiBreakdownHeader}>
                    <span>{t.breakdown}</span>
                    <span>{principalShare.toFixed(0)}% / {interestShare.toFixed(0)}%</span>
                  </div>
                  <div className={styles.emiBreakdownBar}>
                    <div
                      className={styles.emiBreakdownPrincipal}
                      style={{ width: `${principalShare}%` }}
                    />
                    <div
                      className={styles.emiBreakdownInterest}
                      style={{ width: `${interestShare}%` }}
                    />
                  </div>
                  <div className={styles.emiBreakdownLegend}>
                    <span>
                      <i className={styles.legendDotPrincipal} />
                      {t.principal}
                    </span>
                    <span>
                      <i className={styles.legendDotInterest} />
                      {t.totalInterest}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.emiEmpty}>{t.enterValidInputs}</p>
            )}
          </div>
        </div>

        {result && amortizationSchedule.length > 0 && (
          <EmiAmortizationChart
            schedule={amortizationSchedule}
            groupByYear={groupChartByYear}
            labels={{
              title: t.chartTitle,
              subtitle: t.chartSubtitle,
              principalPortion: t.principalPortion,
              interestPortion: t.interestPortion,
              periodAxis: groupChartByYear ? t.year : t.month,
              outstandingBalance: t.outstandingBalance,
            }}
          />
        )}
      </div>
    </section>
  );
}
