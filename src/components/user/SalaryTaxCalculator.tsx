"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { formatNpr } from "@/lib/emi";
import {
  calculateSalaryTax,
  formatRate,
  type FiscalYear,
  type MaritalStatus,
} from "@/lib/salaryTax";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

function parseAmount(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function SalaryTaxCalculator() {
  const { msg } = useLanguage();
  const t = msg.calculators.salaryTaxForm;

  const [fiscalYear, setFiscalYear] = useState<FiscalYear>("2083-84");
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus>("unmarried");
  const [isSsfContributor, setIsSsfContributor] = useState(false);
  const [isFemale, setIsFemale] = useState(false);
  const [monthlySalary, setMonthlySalary] = useState("75000");
  const [allowance, setAllowance] = useState("0");
  const [months, setMonths] = useState("12");
  const [bonus, setBonus] = useState("0");
  const [ssf, setSsf] = useState("0");
  const [epf, setEpf] = useState("0");
  const [cit, setCit] = useState("0");
  const [lifeInsurance, setLifeInsurance] = useState("0");
  const [medicalInsurance, setMedicalInsurance] = useState("0");

  const totalSalary = useMemo(
    () =>
      parseAmount(monthlySalary) * (parseInt(months, 10) || 0) +
      parseAmount(allowance) +
      parseAmount(bonus),
    [monthlySalary, allowance, months, bonus]
  );

  const result = useMemo(
    () =>
      calculateSalaryTax({
        fiscalYear,
        maritalStatus,
        isSsfContributor,
        isFemale,
        monthlySalary: parseAmount(monthlySalary),
        allowance: parseAmount(allowance),
        months: Math.min(20, Math.max(1, parseInt(months, 10) || 12)),
        bonus: parseAmount(bonus),
        ssf: parseAmount(ssf),
        epf: parseAmount(epf),
        cit: parseAmount(cit),
        lifeInsurance: parseAmount(lifeInsurance),
        medicalInsurance: parseAmount(medicalInsurance),
      }),
    [
      fiscalYear,
      maritalStatus,
      isSsfContributor,
      isFemale,
      monthlySalary,
      allowance,
      months,
      bonus,
      ssf,
      epf,
      cit,
      lifeInsurance,
      medicalInsurance,
    ]
  );

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← {msg.calculators.back}
        </Link>
        <header className={styles.emiHeader}>
          <h1>{msg.calculators.salaryTax}</h1>
          <p className={pageStyles.calculatorSubtitle}>{t.subtitle}</p>
        </header>

        <div className={styles.emiLayout}>
          <div className={styles.emiPanel}>
            <h2 className={styles.emiPanelTitle}>{t.yourDetails}</h2>

            <div className={styles.emiField}>
              <label htmlFor="fiscal-year">{t.fiscalYear}</label>
              <select
                id="fiscal-year"
                className={styles.emiNumberInput}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value as FiscalYear)}
              >
                <option value="2083-84">FY 2083/84</option>
                <option value="2082-83">FY 2082/83</option>
              </select>
            </div>

            <div className={styles.emiField}>
              <label>{t.maritalStatus}</label>
              <div className={styles.emiUnitToggle} role="group">
                <button
                  type="button"
                  className={
                    maritalStatus === "unmarried" ? styles.emiUnitActive : styles.emiUnitBtn
                  }
                  onClick={() => setMaritalStatus("unmarried")}
                >
                  {t.unmarried}
                </button>
                <button
                  type="button"
                  className={
                    maritalStatus === "married" ? styles.emiUnitActive : styles.emiUnitBtn
                  }
                  onClick={() => setMaritalStatus("married")}
                >
                  {t.married}
                </button>
              </div>
            </div>

            <div className={styles.emiCheckboxRow}>
              <label className={styles.emiCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={isSsfContributor}
                  onChange={(e) => setIsSsfContributor(e.target.checked)}
                />
                <span>
                  <strong>{t.ssfContributor}</strong>
                  <small>{t.ssfContributorHint}</small>
                </span>
              </label>
              <label className={styles.emiCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={isFemale}
                  onChange={(e) => setIsFemale(e.target.checked)}
                />
                <span>
                  <strong>{t.femaleEmployee}</strong>
                  <small>{t.femaleEmployeeHint}</small>
                </span>
              </label>
            </div>

            <h3 className={styles.emiSubsectionTitle}>{t.annualIncome}</h3>

            <div className={styles.emiRow}>
              <div className={styles.emiField}>
                <label htmlFor="monthly-salary">{t.monthlySalary}</label>
                <input
                  id="monthly-salary"
                  type="number"
                  min="0"
                  className={styles.emiNumberInput}
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                />
              </div>
              <div className={styles.emiField}>
                <label htmlFor="months">{t.months}</label>
                <input
                  id="months"
                  type="number"
                  min="1"
                  max="20"
                  className={styles.emiNumberInput}
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </div>
            </div>

            <h4 className={styles.emiSubsectionSubtitle}>{t.annualAllowanceBonus}</h4>

            <div className={styles.emiRow}>
              <div className={styles.emiField}>
                <label htmlFor="allowance">{t.allowance}</label>
                <input
                  id="allowance"
                  type="number"
                  min="0"
                  className={styles.emiNumberInput}
                  value={allowance}
                  onChange={(e) => setAllowance(e.target.value)}
                />
              </div>
              <div className={styles.emiField}>
                <label htmlFor="bonus">{t.bonus}</label>
                <input
                  id="bonus"
                  type="number"
                  min="0"
                  className={styles.emiNumberInput}
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.emiComputedRow}>
              <span>{t.totalSalary}</span>
              <strong>{formatNpr(totalSalary)}</strong>
            </div>

            <h3 className={styles.emiSubsectionTitle}>{t.annualDeductions}</h3>

            <div className={styles.emiRow}>
              <div className={styles.emiField}>
                <label htmlFor="ssf">{t.ssf}</label>
                <input
                  id="ssf"
                  type="number"
                  min="0"
                  className={styles.emiNumberInput}
                  value={ssf}
                  onChange={(e) => setSsf(e.target.value)}
                />
              </div>
              <div className={styles.emiField}>
                <label htmlFor="epf">{t.epf}</label>
                <input
                  id="epf"
                  type="number"
                  min="0"
                  className={styles.emiNumberInput}
                  value={epf}
                  onChange={(e) => setEpf(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.emiField}>
              <label htmlFor="cit">{t.cit}</label>
              <input
                id="cit"
                type="number"
                min="0"
                className={styles.emiNumberInput}
                value={cit}
                onChange={(e) => setCit(e.target.value)}
              />
              <p className={styles.emiFieldHint}>{t.citHint}</p>
            </div>

            <div className={styles.emiRow}>
              <div className={styles.emiField}>
                <label htmlFor="life-insurance">{t.lifeInsurance}</label>
                <input
                  id="life-insurance"
                  type="number"
                  min="0"
                  max="40000"
                  className={styles.emiNumberInput}
                  value={lifeInsurance}
                  onChange={(e) => setLifeInsurance(e.target.value)}
                />
              </div>
              <div className={styles.emiField}>
                <label htmlFor="medical-insurance">{t.medicalInsurance}</label>
                <input
                  id="medical-insurance"
                  type="number"
                  min="0"
                  max="20000"
                  className={styles.emiNumberInput}
                  value={medicalInsurance}
                  onChange={(e) => setMedicalInsurance(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={`${styles.emiPanel} ${styles.emiResultsPanel}`}>
            <h2 className={styles.emiPanelTitle}>{t.estimatedTax}</h2>

            <div className={`${styles.emiStat} ${styles.emiFadeCard} ${styles.emiStatAssessable}`}>
              <span className={styles.emiStatLabel}>{t.netAssessable}</span>
              <span className={styles.emiStatValue}>{formatNpr(result.netAssessable)}</span>
            </div>

            <div className={styles.emiTaxLiabilitySection}>
              <span className={styles.emiTaxLiabilityHeading}>{t.netTaxLiability}</span>
              <div className={styles.emiTaxLiabilityGrid}>
                <div className={`${styles.emiTaxLiabilityBox} ${styles.emiFadeCard}`}>
                  <span className={styles.emiTaxLiabilityPeriod}>{t.annualTax}</span>
                  <span className={styles.emiTaxLiabilityAmount}>{formatNpr(result.netTax)}</span>
                </div>
                <div className={`${styles.emiTaxLiabilityBox} ${styles.emiFadeCard}`}>
                  <span className={styles.emiTaxLiabilityPeriod}>{t.monthlyTax}</span>
                  <span className={styles.emiTaxLiabilityAmount}>
                    {formatNpr(result.monthlyTax)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.emiStatGrid}>
              <div className={`${styles.emiStat} ${styles.emiFadeCard}`}>
                <span className={styles.emiStatLabel}>{t.totalIncome}</span>
                <span className={styles.emiStatValue}>{formatNpr(result.totalIncome)}</span>
              </div>
              <div className={`${styles.emiStat} ${styles.emiFadeCard}`}>
                <span className={styles.emiStatLabel}>{t.totalDeduction}</span>
                <span className={styles.emiStatValue}>{formatNpr(result.totalDeduction)}</span>
              </div>
              <div className={`${styles.emiStat} ${styles.emiFadeCard}`}>
                <span className={styles.emiStatLabel}>{t.retirementApplied}</span>
                <span className={styles.emiStatValue}>
                  {formatNpr(result.appliedRetirement)}
                </span>
              </div>
              <div className={`${styles.emiStat} ${styles.emiFadeCard}`}>
                <span className={styles.emiStatLabel}>{t.lifeInsuranceApplied}</span>
                <span className={styles.emiStatValue}>
                  {formatNpr(result.appliedLifeInsurance)}
                </span>
              </div>
              <div className={`${styles.emiStat} ${styles.emiFadeCard} ${styles.emiStatFull}`}>
                <span className={styles.emiStatLabel}>{t.medicalInsuranceApplied}</span>
                <span className={styles.emiStatValue}>
                  {formatNpr(result.appliedMedicalInsurance)}
                </span>
              </div>
            </div>

            {result.femaleRebate > 0 && (
              <div className={styles.emiRebateNote}>
                {t.femaleRebateApplied}: {formatNpr(result.femaleRebate)}
              </div>
            )}
          </div>
        </div>

        <div className={styles.emiBreakdownSection}>
          <div className={styles.emiBreakdownSectionHeader}>
            <h3 className={styles.emiBreakdownSectionTitle}>{t.breakdownTitle}</h3>
            <p className={styles.emiBreakdownSectionSubtitle}>{t.breakdownSubtitle}</p>
          </div>
          <div className={styles.emiTableWrap}>
            <table className={styles.emiTable}>
              <thead>
                <tr>
                  <th>{t.slabColumn}</th>
                  <th>{t.rateColumn}</th>
                  <th>{t.taxableColumn}</th>
                  <th>{t.taxColumn}</th>
                </tr>
              </thead>
              <tbody>
                {result.slabs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emiTableEmpty}>
                      {t.noTaxableIncome}
                    </td>
                  </tr>
                ) : (
                  result.slabs.map((slab, index) => (
                    <tr
                      key={slab.label}
                      className={index % 2 === 0 ? styles.emiTableRowAlt : undefined}
                    >
                      <td>{slab.label}</td>
                      <td>
                        {slab.waived ? (
                          <span className={styles.emiWaivedBadge}>{t.waived}</span>
                        ) : (
                          formatRate(slab.rate)
                        )}
                      </td>
                      <td>{formatNpr(slab.taxableAmount)}</td>
                      <td>{formatNpr(slab.tax)}</td>
                    </tr>
                  ))
                )}
                <tr className={styles.emiTableTotal}>
                  <td colSpan={3}>{t.grossTax}</td>
                  <td>{formatNpr(result.grossTax)}</td>
                </tr>
                {result.femaleRebate > 0 && (
                  <tr className={styles.emiTableRebate}>
                    <td colSpan={3}>{t.femaleRebateApplied}</td>
                    <td>-{formatNpr(result.femaleRebate)}</td>
                  </tr>
                )}
                <tr className={styles.emiTableGrandTotal}>
                  <td colSpan={3}>{t.netTaxLiability}</td>
                  <td>{formatNpr(result.netTax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className={styles.emiDisclaimer}>{t.disclaimer}</p>
      </div>
    </section>
  );
}
