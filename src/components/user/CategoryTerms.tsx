"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { SaralSewaEntry } from "@/types/saralsewa";
import styles from "@/app/user.module.css";

interface CategoryTermsProps {
  entries: SaralSewaEntry[];
}

export function CategoryTerms({ entries }: CategoryTermsProps) {
  const { msg } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const t = msg.categoriesPage;

  return (
    <ul className={styles.terminologyResults}>
      {entries.map((entry, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <li key={`${entry.term}-${entry.number}`}>
            <div
              className={`${styles.terminologyResultCard} ${
                isExpanded ? styles.terminologyResultExpanded : ""
              }`}
            >
              <button
                type="button"
                className={styles.terminologyResultTrigger}
                aria-expanded={isExpanded}
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div className={styles.termItemHeader}>
                  <span className={styles.termName}>{entry.term}</span>
                  <span className={styles.termCat}>{entry["Roman Transliteration"]}</span>
                </div>
                {entry.english && (
                  <p className={styles.terminologyEnglish}>{entry.english}</p>
                )}
              </button>

              {isExpanded && (
                <div className={styles.categoryTermDetail}>
                  {entry.meaningNe && (
                    <div className={styles.categoryMeaningBlock}>
                      <h4>{t.meaningNe}</h4>
                      <p>{entry.meaningNe}</p>
                    </div>
                  )}
                  {entry.meaningEn && (
                    <div className={styles.categoryMeaningBlock}>
                      <h4>{t.meaningEn}</h4>
                      <p>{entry.meaningEn}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
