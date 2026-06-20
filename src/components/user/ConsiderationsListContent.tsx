"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  CONSIDERATION_CATEGORIES,
  considerationCategoryPath,
  considerationTopicPath,
} from "@/lib/considerations";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

export function ConsiderationsListContent() {
  const { msg } = useLanguage();
  const page = msg.considerationsPage;
  const labels = msg.considerations;

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← {page.back}
        </Link>

        <header className={styles.emiHeader}>
          <h1>{page.title}</h1>
          <p className={pageStyles.calculatorSubtitle}>{page.subtitle}</p>
        </header>

        <div className={styles.considerationsHubList}>
          {CONSIDERATION_CATEGORIES.map((category) => (
            <section
              key={category.slug}
              className={`${styles.emiFadeCard} ${styles.emiFormSection} ${styles.considerationsHubCard}`}
            >
              <Link
                href={considerationCategoryPath(category.slug)}
                className={styles.considerationsHubCardHeading}
              >
                <span className={styles.considerationsHubIcon} aria-hidden>
                  {category.icon}
                </span>
                <div>
                  <h2>{labels[category.labelKey]}</h2>
                  <p>{labels[category.descriptionKey]}</p>
                </div>
              </Link>
              <ul className={styles.considerationsHubTopics}>
                {category.topics.map((topic) => (
                  <li key={topic.slug}>
                    <Link href={considerationTopicPath(category.slug, topic.slug)}>
                      {labels[topic.labelKey]}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
