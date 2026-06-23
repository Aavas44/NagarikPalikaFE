"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  considerationCategoryPath,
  type ConsiderationCategorySlug,
  type ConsiderationTopicSlug,
} from "@/lib/considerations";
import { getConsiderationArticle } from "@/lib/considerationArticles";
import { ConsiderationArticleView } from "@/components/user/ConsiderationArticleView";
import pageStyles from "@/app/user.module.css";
import styles from "./emi.module.css";

interface ConsiderationTopicContentProps {
  categorySlug: ConsiderationCategorySlug;
  topicSlug: ConsiderationTopicSlug;
  categoryLabelKey: string;
  topicLabelKey: string;
  topicDescriptionKey: string;
}

export function ConsiderationTopicContent({
  categorySlug,
  topicSlug,
  categoryLabelKey,
  topicLabelKey,
  topicDescriptionKey,
}: ConsiderationTopicContentProps) {
  const { msg, locale } = useLanguage();
  const page = msg.considerationsPage;
  const labels = msg.considerations;
  const article = getConsiderationArticle(categorySlug, topicSlug, locale);

  return (
    <section className={pageStyles.calculatorPage}>
      <div className={`${pageStyles.calculatorPageInner} ${styles.emiPageInner}`}>
        <Link href={considerationCategoryPath(categorySlug)} className={pageStyles.calculatorBack}>
          ← {labels[categoryLabelKey as keyof typeof labels]}
        </Link>

        <header className={styles.emiHeader}>
          <h1>{labels[topicLabelKey as keyof typeof labels]}</h1>
          <p className={pageStyles.calculatorSubtitle}>
            {labels[topicDescriptionKey as keyof typeof labels]}
          </p>
        </header>

        {article ? (
          <div className={`${styles.emiFadeCard} ${styles.considerationArticleCard}`}>
            <ConsiderationArticleView article={article} lang={locale} />
          </div>
        ) : (
          <div className={`${styles.emiFadeCard} ${styles.emiFormSection} ${styles.considerationsComingSoon}`}>
            <p>{page.contentComingSoon}</p>
          </div>
        )}

        <Link href="/considerations" className={styles.templateHomeLink}>
          ← {page.allConsiderations}
        </Link>
      </div>
    </section>
  );
}
