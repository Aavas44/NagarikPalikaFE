"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  buildCopyText,
  convertLand,
  formatHillVerbose,
  formatSqFt,
  formatSqM,
  formatTeraiVerbose,
  getHillValidationWarnings,
  getTeraiValidationWarnings,
  type HillUnits,
  type LandSystem,
  type LandUnitLabels,
  type TeraiUnits,
} from "@/lib/landConverter";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

const GLOSSARY_TERMS: Record<string, string> = {
  ropani: "Ropani",
  anna: "Anna",
  paisa: "Paisa",
  daam: "Daam",
  bigha: "Bigha",
  kattha: "Kattha",
  dhur: "Dhur",
};

function parseIntField(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseFloatField(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function LandConverterCalculator() {
  const { msg } = useLanguage();
  const t = msg.calculators.landConverterForm;

  const [system, setSystem] = useState<LandSystem>("hill");
  const [hill, setHill] = useState<HillUnits>({ ropani: 1, anna: 0, paisa: 0, daam: 0 });
  const [terai, setTerai] = useState<TeraiUnits>({ bigha: 1, kattha: 0, dhur: 0 });
  const [sqMInput, setSqMInput] = useState("");
  const [metricMode, setMetricMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (metricMode && sqMInput !== "") {
      return convertLand(system, system === "hill" ? hill : terai, parseFloatField(sqMInput));
    }
    return convertLand(system, system === "hill" ? hill : terai);
  }, [system, hill, terai, sqMInput, metricMode]);

  const validationWarnings = useMemo(() => {
    return system === "hill" ? getHillValidationWarnings(hill) : getTeraiValidationWarnings(terai);
  }, [system, hill, terai]);

  const unitLabels: LandUnitLabels = {
    ropani: t.ropani,
    anna: t.anna,
    paisa: t.paisa,
    daam: t.daam,
    bigha: t.bigha,
    kattha: t.kattha,
    dhur: t.dhur,
  };

  const activeCompound =
    system === "hill"
      ? formatHillVerbose(result.hill, unitLabels)
      : formatTeraiVerbose(result.terai, unitLabels);

  const copyText = buildCopyText(system, result, {
    ...unitLabels,
    sqM: t.sqM,
    sqFt: t.sqFt,
  });

  function handleSystemChange(next: LandSystem) {
    if (next === system) return;
    if (next === "hill") {
      setHill({ ropani: 1, anna: 0, paisa: 0, daam: 0 });
    } else {
      setTerai({ bigha: 1, kattha: 0, dhur: 0 });
    }
    setSystem(next);
    setMetricMode(false);
    setSqMInput("");
  }

  function updateHill(field: keyof HillUnits, value: string) {
    setMetricMode(false);
    setSqMInput("");
    setHill((prev) => ({ ...prev, [field]: parseIntField(value) }));
  }

  function updateTerai(field: keyof TeraiUnits, value: string) {
    setMetricMode(false);
    setSqMInput("");
    setTerai((prev) => ({ ...prev, [field]: parseIntField(value) }));
  }

  function handleSqMChange(value: string) {
    setSqMInput(value);
    setMetricMode(true);
    const sqM = parseFloatField(value);
    if (system === "hill") {
      setHill(convertLand("hill", hill, sqM).hill);
    } else {
      setTerai(convertLand("terai", terai, sqM).terai);
    }
  }

  function applyPreset(type: "oneRopani" | "fourAnna" | "oneBigha" | "oneKattha") {
    setMetricMode(false);
    setSqMInput("");
    if (type === "oneRopani") {
      setSystem("hill");
      setHill({ ropani: 1, anna: 0, paisa: 0, daam: 0 });
    } else if (type === "fourAnna") {
      setSystem("hill");
      setHill({ ropani: 0, anna: 4, paisa: 0, daam: 0 });
    } else if (type === "oneBigha") {
      setSystem("terai");
      setTerai({ bigha: 1, kattha: 0, dhur: 0 });
    } else {
      setSystem("terai");
      setTerai({ bigha: 0, kattha: 1, dhur: 0 });
    }
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [copyText]);

  const registrationTaxHref = `/calculators/land-registration-tax?sqm=${encodeURIComponent(result.sqM.toFixed(2))}`;

  const sqMDisplay =
    metricMode && sqMInput !== ""
      ? sqMInput
      : result.sqM > 0
        ? result.sqM.toFixed(2)
        : "";

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← {msg.calculators.back}
        </Link>
        <header className={styles.emiHeader}>
          <h1>{msg.calculators.landConverter}</h1>
          <p className={pageStyles.calculatorSubtitle}>{t.subtitle}</p>
        </header>

        <div className={styles.emiLayout}>
          <div className={styles.emiPanel}>
            <h2 className={styles.emiPanelTitle}>{t.inputSection}</h2>

            <div className={styles.emiField}>
              <label>{t.system}</label>
              <div className={styles.emiUnitToggle} role="group">
                <button
                  type="button"
                  className={system === "hill" ? styles.emiUnitActive : styles.emiUnitBtn}
                  onClick={() => handleSystemChange("hill")}
                >
                  {t.hillSystem}
                </button>
                <button
                  type="button"
                  className={system === "terai" ? styles.emiUnitActive : styles.emiUnitBtn}
                  onClick={() => handleSystemChange("terai")}
                >
                  {t.teraiSystem}
                </button>
              </div>
            </div>

            {system === "hill" ? (
              <div className={`${styles.emiCompoundRow} ${styles.emiField}`}>
                {(["ropani", "anna", "paisa", "daam"] as const).map((field) => (
                  <div key={field} className={styles.emiCompoundField}>
                    <label htmlFor={`hill-${field}`}>
                      <Link
                        href={`/terminology?q=${GLOSSARY_TERMS[field]}`}
                        className={styles.emiGlossaryLink}
                      >
                        {unitLabels[field]}
                      </Link>
                    </label>
                    <input
                      id={`hill-${field}`}
                      type="number"
                      min="0"
                      className={styles.emiNumberInput}
                      value={hill[field]}
                      onChange={(e) => updateHill(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${styles.emiRow} ${styles.emiField}`}>
                {(["bigha", "kattha", "dhur"] as const).map((field) => (
                  <div key={field} className={styles.emiCompoundField}>
                    <label htmlFor={`terai-${field}`}>
                      <Link
                        href={`/terminology?q=${GLOSSARY_TERMS[field]}`}
                        className={styles.emiGlossaryLink}
                      >
                        {unitLabels[field]}
                      </Link>
                    </label>
                    <input
                      id={`terai-${field}`}
                      type="number"
                      min="0"
                      className={styles.emiNumberInput}
                      value={terai[field]}
                      onChange={(e) => updateTerai(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <p className={styles.emiFieldHint}>
              {system === "hill" ? t.hillHierarchy : t.teraiHierarchy}
            </p>

            {validationWarnings.length > 0 && (
              <p className={styles.emiValidationWarning}>
                {t.unitWarning.replace("{unit}", validationWarnings.join(", "))}
              </p>
            )}

            <div className={styles.emiField}>
              <label htmlFor="sqm-input">{t.sqM}</label>
              <input
                id="sqm-input"
                type="number"
                min="0"
                step="0.01"
                className={styles.emiNumberInput}
                value={sqMDisplay}
                onChange={(e) => handleSqMChange(e.target.value)}
              />
              <p className={styles.emiFieldHint}>{t.sqMHint}</p>
            </div>

            <div className={styles.emiField}>
              <span className={styles.emiFieldHint}>{t.presets}</span>
              <div className={styles.emiPresets}>
                <button
                  type="button"
                  className={styles.emiPreset}
                  onClick={() => applyPreset("oneRopani")}
                >
                  {t.presetOneRopani}
                </button>
                <button
                  type="button"
                  className={styles.emiPreset}
                  onClick={() => applyPreset("fourAnna")}
                >
                  {t.presetFourAnna}
                </button>
                <button
                  type="button"
                  className={styles.emiPreset}
                  onClick={() => applyPreset("oneBigha")}
                >
                  {t.presetOneBigha}
                </button>
                <button
                  type="button"
                  className={styles.emiPreset}
                  onClick={() => applyPreset("oneKattha")}
                >
                  {t.presetOneKattha}
                </button>
              </div>
            </div>
          </div>

          <div className={`${styles.emiPanel} ${styles.emiResultsPanel}`}>
            <h2 className={styles.emiPanelTitle}>{t.results}</h2>

            <div className={styles.emiEmiHero}>
              <span className={styles.emiEmiLabel}>{t.convertedArea}</span>
              <span className={`${styles.emiEmiAmount} ${styles.emiEmiAmountCompound}`}>
                {activeCompound}
              </span>
              <span className={styles.emiEmiSub}>
                {formatSqM(result.sqM)} {t.sqM} · {formatSqFt(result.sqFt)} {t.sqFt}
              </span>
            </div>

            <div className={styles.emiStatGrid}>
              <div className={styles.emiStat}>
                <span className={styles.emiStatLabel}>{t.hillEquivalent}</span>
                <span className={`${styles.emiStatValue} ${styles.emiStatValueCompound}`}>
                  {formatHillVerbose(result.hill, unitLabels)}
                </span>
              </div>
              <div className={styles.emiStat}>
                <span className={styles.emiStatLabel}>{t.teraiEquivalent}</span>
                <span className={`${styles.emiStatValue} ${styles.emiStatValueCompound}`}>
                  {formatTeraiVerbose(result.terai, unitLabels)}
                </span>
              </div>
              <div className={`${styles.emiStat} ${styles.emiStatFull}`}>
                <span className={styles.emiStatLabel}>{t.crossSystemEstimate}</span>
                <span className={styles.emiStatValue}>{t.crossSystemNote}</span>
              </div>
            </div>

            <button type="button" className={styles.emiCopyBtn} onClick={handleCopy}>
              {copied ? t.copied : t.copyResult}
            </button>

            <Link href={registrationTaxHref} className={styles.emiCrossLink}>
              {t.registrationTaxLink} →
            </Link>
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
                  <th>{t.unitColumn}</th>
                  <th>{t.quantityColumn}</th>
                  <th>{t.perUnitColumn}</th>
                  <th>{t.contributionColumn}</th>
                </tr>
              </thead>
              <tbody>
                {result.breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emiTableEmpty}>
                      {t.noBreakdown}
                    </td>
                  </tr>
                ) : (
                  result.breakdown.map((row, index) => (
                    <tr
                      key={row.unitKey}
                      className={index % 2 === 0 ? styles.emiTableRowAlt : undefined}
                    >
                      <td>{unitLabels[row.unitKey as keyof LandUnitLabels] ?? row.unitKey}</td>
                      <td>{row.quantity}</td>
                      <td>{formatSqM(row.sqMPerUnit)}</td>
                      <td>{formatSqM(row.sqMContribution)}</td>
                    </tr>
                  ))
                )}
                <tr className={styles.emiTableGrandTotal}>
                  <td colSpan={3}>{t.totalRow}</td>
                  <td>
                    {formatSqM(result.sqM)} {t.sqM}
                  </td>
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
