"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import styles from "@/app/user.module.css";

const iconColorClass = {
  blue: styles.cardIconBlue,
  green: styles.cardIconGreen,
  amber: styles.cardIconAmber,
  teal: styles.cardIconTeal,
} as const;

export function CalculatorsListContent() {
  const { msg } = useLanguage();
  const t = msg.calculatorsPage;

  return (
    <section className={styles.calculatorsPage}>
      <div className={styles.calculatorsPageInner}>
        <Link href="/" className={styles.calculatorBack}>
          ← {t.back}
        </Link>
        <header className={styles.calculatorsPageHeader}>
          <h1>{t.title}</h1>
          <p>{t.subtitle.replace("{count}", String(CALCULATOR_ITEMS.length))}</p>
        </header>
        <div className={styles.cards}>
          {CALCULATOR_ITEMS.map((item) => {
            const label = msg.calculators[item.labelKey];
            const description = msg.calculators[item.descriptionKey];

            return (
              <Link
                key={item.slug}
                href={`/calculators/${item.slug}`}
                className={styles.card}
              >
                <div className={`${styles.cardIcon} ${iconColorClass[item.iconColor]}`}>
                  {item.icon}
                </div>
                <h3>{label}</h3>
                <p>{description}</p>
                {!item.available && (
                  <span className={styles.calcListBadge}>{msg.calculators.comingSoon}</span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
