"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  considerationTopicPath,
  type ConsiderationCategorySlug,
} from "@/lib/considerations";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

interface ConsiderationCategoryContentProps {
  categorySlug: ConsiderationCategorySlug;
  icon: string;
  labelKey: string;
  descriptionKey: string;
  topics: readonly { slug: string; labelKey: string; descriptionKey: string }[];
}

export function ConsiderationCategoryContent({
  categorySlug,
  icon,
  labelKey,
  descriptionKey,
  topics,
}: ConsiderationCategoryContentProps) {
  const { msg } = useLanguage();
  const page = msg.considerationsPage;
  const labels = msg.considerations;

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/considerations" className={pageStyles.calculatorBack}>
          ← {page.allConsiderations}
        </Link>

        <header className={styles.emiHeader}>
          <span className={styles.considerationsHubIconLarge} aria-hidden>
            {icon}
          </span>
          <h1>{labels[labelKey as keyof typeof labels]}</h1>
          <p className={pageStyles.calculatorSubtitle}>
            {labels[descriptionKey as keyof typeof labels]}
          </p>
        </header>

        <div className={styles.considerationsTopicGrid}>
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={considerationTopicPath(categorySlug, topic.slug)}
              className={`${styles.emiFadeCard} ${styles.considerationsTopicCard}`}
            >
              <h3>{labels[topic.labelKey as keyof typeof labels]}</h3>
              <p>{labels[topic.descriptionKey as keyof typeof labels]}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
