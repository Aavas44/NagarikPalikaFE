import type { ConsiderationArticle, ConsiderationExampleOutcome } from "@/lib/considerationArticles";
import styles from "./emi.module.css";

function exampleLabel(outcome: ConsiderationExampleOutcome, lang: "en" | "ne"): string {
  if (outcome === "saved") return lang === "ne" ? "जाँचले बचायो" : "Due diligence helped";
  return lang === "ne" ? "जाँच नगर्दा नोक्सान" : "Cost of skipping checks";
}

interface ConsiderationArticleViewProps {
  article: ConsiderationArticle;
  lang: "en" | "ne";
}

export function ConsiderationArticleView({ article, lang }: ConsiderationArticleViewProps) {
  return (
    <article lang={lang} className={styles.considerationArticle}>
      <p className={styles.considerationArticleLead}>{article.lead}</p>

      {article.sections.map((section) => (
        <section key={section.heading} className={styles.considerationArticleSection}>
          <h2 className={styles.considerationArticleHeading}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className={styles.considerationArticleText}>
              {paragraph}
            </p>
          ))}

          {section.checklist && section.checklist.length > 0 && (
            <ul className={styles.considerationArticleList}>
              {section.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          {section.examples?.map((example) => (
            <aside
              key={example.title}
              className={
                example.outcome === "saved"
                  ? styles.considerationExampleSaved
                  : styles.considerationExampleLoss
              }
            >
              <p className={styles.considerationExampleTag}>
                {exampleLabel(example.outcome, lang)}
              </p>
              <h3 className={styles.considerationExampleTitle}>{example.title}</h3>
              <p className={styles.considerationExampleBody}>{example.body}</p>
            </aside>
          ))}
        </section>
      ))}

      <section className={styles.considerationArticleSection}>
        <h2 className={styles.considerationArticleHeading}>{article.checklistTitle}</h2>
        <ul className={styles.considerationArticleQuickList}>
          {article.quickChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.considerationArticleText}>{article.closing}</p>
        <p className={styles.considerationArticleDisclaimer}>{article.disclaimer}</p>
      </section>
    </article>
  );
}
