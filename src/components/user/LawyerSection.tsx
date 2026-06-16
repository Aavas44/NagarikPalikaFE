"use client";

import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import type { Lawyer } from "@/types";
import styles from "@/app/user.module.css";

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={styles.stars} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? styles.starFull : half && i === full ? styles.starHalf : styles.starEmpty}>
          ★
        </span>
      ))}
      <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
    </span>
  );
}

export function LawyerSection({ lawyers }: { lawyers: Lawyer[] }) {
  const { locale, msg } = useLanguage();

  return (
    <>
      <div className={styles.divider} />
      <div className={styles.section} id="lawyers">
        <div className={styles.sectionHeader}>
          <div>
            <h2>{msg.sections.consultLawyer}</h2>
            <p className={styles.sectionSub}>{msg.sections.consultLawyerSub}</p>
          </div>
        </div>
        <div className={styles.lawyerGrid}>
          {lawyers.map((lawyer) => (
            <div key={lawyer.id} className={styles.lawyerCard}>
              <div className={styles.lawyerAvatar}>⚖️</div>
              <h3>{pickLocalized(locale, lawyer.lawyerName)}</h3>
              <p className={styles.lawyerFirm}>
                {msg.lawyers.firm}: {pickLocalized(locale, lawyer.firmName)}
              </p>
              <p className={styles.lawyerLocation}>
                📍 {pickLocalized(locale, lawyer.officeLocation)}
              </p>
              <div className={styles.lawyerRating}>
                <StarRating rating={lawyer.rating} />
                <span className={styles.reviewCount}>
                  ({lawyer.ratingCount} {msg.sections.reviews})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
