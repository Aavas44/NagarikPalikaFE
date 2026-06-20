"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { formatNpr } from "@/lib/emi";
import {
  BS_MONTHS_EN,
  BS_MONTHS_NE,
  BS_YEAR_OPTIONS,
  type BsDate,
  clampBsDate,
  formatBsDate,
  getDaysInBsMonth,
  getTodayBs,
} from "@/lib/nepaliCalendar";
import {
  calculateVehicleTax,
  getCapacityLimits,
  getCapacitySliderStep,
  getDefaultLastRenewalBs,
  getTaxSlabsForType,
  VEHICLE_TAX_FY,
  type VehicleType,
  formatFineRate,
} from "@/lib/vehicleTax";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

const VEHICLE_TYPES: VehicleType[] = ["motorcycle", "car", "ev_bike", "ev_car"];

export function VehicleTaxCalculator() {
  const { locale, msg } = useLanguage();
  const t = msg.calculators.vehicleTaxForm;
  const todayBs = getTodayBs();

  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [capacity, setCapacity] = useState(150);
  const [capacityInput, setCapacityInput] = useState("150");
  const [lastRenewal, setLastRenewal] = useState<BsDate>(() =>
    clampBsDate(getDefaultLastRenewalBs(), getTodayBs())
  );

  const capacityLimits = getCapacityLimits(vehicleType);
  const sliderStep = getCapacitySliderStep(vehicleType);

  const renewalYearOptions = useMemo(
    () => BS_YEAR_OPTIONS.filter((y) => y <= todayBs.year),
    [todayBs.year]
  );

  const renewalMonthOptions = useMemo(() => {
    const months = locale === "ne" ? BS_MONTHS_NE : BS_MONTHS_EN;
    const maxMonth = lastRenewal.year === todayBs.year ? todayBs.month : 12;
    return months.slice(0, maxMonth).map((name, index) => ({ name, value: index + 1 }));
  }, [lastRenewal.year, todayBs.year, todayBs.month, locale]);

  const renewalDayOptions = useMemo(() => {
    const dim = getDaysInBsMonth(lastRenewal.year, lastRenewal.month);
    const maxDay =
      lastRenewal.year === todayBs.year && lastRenewal.month === todayBs.month
        ? todayBs.day
        : dim;
    return Array.from({ length: maxDay }, (_, i) => i + 1);
  }, [lastRenewal.year, lastRenewal.month, todayBs.year, todayBs.month, todayBs.day]);

  const result = useMemo(() => {
    return calculateVehicleTax({
      vehicleType,
      capacity,
      lastRenewal,
    });
  }, [vehicleType, capacity, lastRenewal]);

  const rateSlabs = useMemo(() => getTaxSlabsForType(vehicleType), [vehicleType]);

  function getSlabLabel(slabId: string): string {
    const labels = t.slabLabels as Record<string, string>;
    return labels[slabId] ?? slabId;
  }

  function handleVehicleTypeChange(type: VehicleType) {
    setVehicleType(type);
    const defaults: Record<VehicleType, number> = {
      motorcycle: 150,
      car: 1500,
      ev_bike: 1500,
      ev_car: 75,
    };
    const next = defaults[type];
    setCapacity(next);
    setCapacityInput(String(next));
  }

  function commitCapacityInput(raw: string) {
    const parsed = Number(raw.replace(/,/g, "").trim());
    const { min, max } = getCapacityLimits(vehicleType);
    const clamped = Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, Math.round(parsed)))
      : min;
    setCapacity(clamped);
    setCapacityInput(String(clamped));
  }

  function handleCapacityInputChange(raw: string) {
    setCapacityInput(raw);
    const parsed = Number(raw.replace(/,/g, "").trim());
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    const { min, max } = getCapacityLimits(vehicleType);
    if (parsed >= min && parsed <= max) {
      setCapacity(Math.round(parsed));
    }
  }

  function updateRenewal(field: keyof BsDate, value: number) {
    setLastRenewal((prev) => {
      const next = clampBsDate(
        {
          ...prev,
          [field]: value,
        },
        todayBs
      );
      const maxDay = getDaysInBsMonth(next.year, next.month);
      if (next.day > maxDay) next.day = maxDay;
      return clampBsDate(next, todayBs);
    });
  }

  const paymentStatusLabel = (key: NonNullable<typeof result>["paymentStatusKey"]) =>
    t.paymentStatus[key as keyof typeof t.paymentStatus];

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/calculators" className={pageStyles.calculatorBack}>
          ← {msg.calculators.back}
        </Link>

        <header className={styles.emiHeader}>
          <h1>{msg.calculators.vehicleTax}</h1>
          <p className={pageStyles.calculatorSubtitle}>
            {t.subtitle.replace("{fy}", VEHICLE_TAX_FY)}
          </p>
        </header>

        <div className={styles.emiLayout}>
          <div className={styles.vehicleTaxLeftColumn}>
            <div className={styles.emiPanel}>
              <h2 className={styles.emiPanelTitle}>{t.vehicleDetails}</h2>

              <div className={styles.emiField}>
                <label>{t.vehicleType}</label>
                <div className={`${styles.emiUnitToggle} ${styles.emiUnitToggleWrap}`} style={{ marginTop: "0.5rem" }}>
                  {VEHICLE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={vehicleType === type ? styles.emiUnitActive : styles.emiUnitBtn}
                      onClick={() => handleVehicleTypeChange(type)}
                    >
                      {t.types[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.emiField}>
                <div className={styles.emiFieldTop}>
                  <label htmlFor="vehicle-capacity">
                    {vehicleType === "ev_bike"
                      ? t.capacityWatts
                      : vehicleType === "ev_car"
                        ? t.capacityKw
                        : t.capacityCc}
                  </label>
                  <span className={styles.emiFieldValue}>
                    {capacity.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")}
                  </span>
                </div>
                <input
                  id="vehicle-capacity"
                  type="range"
                  min={capacityLimits.min}
                  max={capacityLimits.max}
                  step={sliderStep}
                  value={capacity}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCapacity(next);
                    setCapacityInput(String(next));
                  }}
                  className={styles.emiRange}
                />
                <input
                  id="vehicle-capacity-number"
                  type="number"
                  inputMode="numeric"
                  min={capacityLimits.min}
                  max={capacityLimits.max}
                  step={1}
                  value={capacityInput}
                  onChange={(e) => handleCapacityInputChange(e.target.value)}
                  onBlur={() => commitCapacityInput(capacityInput)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitCapacityInput(capacityInput);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className={styles.emiNumberInput}
                  aria-label={
                    vehicleType === "ev_bike"
                      ? t.capacityWatts
                      : vehicleType === "ev_car"
                        ? t.capacityKw
                        : t.capacityCc
                  }
                />
                <p className={styles.emiFieldHint}>{t.capacityInputHint}</p>
              </div>

              <div className={styles.emiField}>
                <label>{t.lastRenewalDate}</label>
                <p className={styles.emiFieldHint}>{t.lastRenewalHint}</p>
                <div className={styles.bsDateRow}>
                  <select
                    className={styles.emiNumberInput}
                    value={lastRenewal.year}
                    onChange={(e) => updateRenewal("year", Number(e.target.value))}
                    aria-label={t.bsYear}
                  >
                    {renewalYearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y} BS
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.emiNumberInput}
                    value={lastRenewal.month}
                    onChange={(e) => updateRenewal("month", Number(e.target.value))}
                    aria-label={t.bsMonth}
                  >
                    {renewalMonthOptions.map(({ name, value }) => (
                      <option key={value} value={value}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.emiNumberInput}
                    value={lastRenewal.day}
                    onChange={(e) => updateRenewal("day", Number(e.target.value))}
                    aria-label={t.bsDay}
                  >
                    {renewalDayOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.emiFieldHint}>
                  {t.todayLabel}: {formatBsDate(todayBs, locale)}
                </p>
              </div>
            </div>

            <div className={styles.emiPanel}>
              <h2 className={styles.emiPanelTitle}>
                {t.rateReferenceTitle.replace("{fy}", VEHICLE_TAX_FY)}
              </h2>
              <p className={styles.emiFieldHint}>{t.rateReferenceHint}</p>
              <div className={styles.emiTableWrap}>
                <table className={styles.emiTable}>
                  <thead>
                    <tr>
                      <th>{t.capacityColumn}</th>
                      <th>{t.taxColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateSlabs.map((slab, index) => {
                      const isMatched = result?.matchedSlab.id === slab.id;
                      return (
                        <tr
                          key={slab.id}
                          className={
                            isMatched
                              ? styles.emiTableRowHighlight
                              : index % 2 === 1
                                ? styles.emiTableRowAlt
                                : undefined
                          }
                        >
                          <td>
                            {getSlabLabel(slab.id)}
                            {isMatched ? " ✓" : ""}
                          </td>
                          <td>{formatNpr(slab.tax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={`${styles.emiPanel} ${styles.emiResultsPanel}`}>
            <h2 className={styles.emiPanelTitle}>{t.results}</h2>

            {result ? (
              <>
                <div className={styles.emiSummaryGrid}>
                  <div className={styles.emiSummaryItem}>
                    <span>{t.matchedCategory}</span>
                    <strong>{t.types[vehicleType]}</strong>
                  </div>
                  <div className={styles.emiSummaryItem}>
                    <span>{t.taxBracket}</span>
                    <strong>{getSlabLabel(result.matchedSlab.id)}</strong>
                  </div>
                  <div className={styles.emiSummaryItem}>
                    <span>{t.annualTaxAmount}</span>
                    <strong>{formatNpr(result.annualTax)}</strong>
                  </div>
                </div>

                <div className={styles.emiEmiHero}>
                  <span className={styles.emiEmiLabel}>{t.totalCost}</span>
                  <span className={styles.emiEmiAmount}>{formatNpr(result.totalCost)}</span>
                  <span className={styles.emiEmiSub}>{t.calculatedAsOfToday}</span>
                </div>

                <div className={styles.emiSummaryGrid}>
                  <div className={styles.emiSummaryItem}>
                    <span>{t.paymentStatusLabel}</span>
                    <strong>{paymentStatusLabel(result.paymentStatusKey)}</strong>
                  </div>
                  {result.nextDueBs && (
                    <div className={styles.emiSummaryItem}>
                      <span>{t.nextDueDate}</span>
                      <strong>{formatBsDate(result.nextDueBs, locale)}</strong>
                    </div>
                  )}
                  {result.daysLate > 0 && (
                    <div className={styles.emiSummaryItem}>
                      <span>{t.daysLate}</span>
                      <strong>
                        {result.daysLate.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")}
                      </strong>
                    </div>
                  )}
                  {result.taxYears > 1 && (
                    <div className={styles.emiSummaryItem}>
                      <span>{t.unpaidYears}</span>
                      <strong>{result.taxYears}</strong>
                    </div>
                  )}
                </div>

                <div className={styles.emiBreakdownSection}>
                  <div className={styles.emiBreakdownSectionHeader}>
                    <h3 className={styles.emiBreakdownSectionTitle}>{t.breakdownTitle}</h3>
                  </div>
                  <div className={styles.emiTableWrap}>
                    <table className={styles.emiTable}>
                      <tbody>
                        <tr>
                          <td>
                            {t.annualVehicleTax}
                            {result.taxYears > 1 ? ` (×${result.taxYears})` : ""}
                          </td>
                          <td>{formatNpr(result.totalTax)}</td>
                        </tr>
                        <tr className={styles.emiTableRowAlt}>
                          <td>{t.renewalCharge}</td>
                          <td>{formatNpr(result.renewalCharge)}</td>
                        </tr>
                        <tr>
                          <td>{t.thirdPartyInsurance}</td>
                          <td>{formatNpr(result.insurance)}</td>
                        </tr>
                        <tr className={styles.emiTableRowAlt}>
                          <td>
                            {t.lateFine} ({formatFineRate(result.lateFineRate)})
                          </td>
                          <td>{formatNpr(result.lateFine)}</td>
                        </tr>
                        <tr className={styles.emiTableGrandTotal}>
                          <td>{t.totalBluebookCost}</td>
                          <td>{formatNpr(result.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.emiTableEmpty}>{t.enterValidInputs}</p>
            )}

            <p className={styles.emiDisclaimer}>{t.disclaimer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
