"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import { getCalculatorCount } from "@/lib/calculators";
import type { Category, Stats, Template, Term } from "@/types";
import type { SaralSewaCategoryCard } from "@/types/saralsewa";
import styles from "@/app/user.module.css";

const iconColorClass: Record<SaralSewaCategoryCard["iconColor"], string> = {
  blue: styles.cardIconBlue,
  green: styles.cardIconGreen,
  amber: styles.cardIconAmber,
  teal: styles.cardIconTeal,
};

interface UserHomeProps {
  stats: Stats;
  glossaryTermsCount: number;
  categories: SaralSewaCategoryCard[];
  terms: Term[];
  templates: Template[];
}

export function UserHome({ stats, glossaryTermsCount, categories, terms, templates }: UserHomeProps) {
  const { locale, msg } = useLanguage();

  const categoryLabel = (cat: Category) =>
    msg.categories[cat as keyof typeof msg.categories] ?? cat;

  return (
    <>
      <div className={styles.stats}>
        <Link href="/terminology" className={styles.stat}>
          <div className={styles.statNum}>
            {glossaryTermsCount.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")}
          </div>
          <div className={styles.statLabel}>{msg.stats.terms}</div>
        </Link>
        <Link href="/templates" className={styles.stat}>
          <div className={styles.statNum}>{stats.templatesCount}+</div>
          <div className={styles.statLabel}>{msg.stats.templates}</div>
        </Link>
        <Link href="/calculators" className={styles.stat}>
          <div className={styles.statNum}>{getCalculatorCount()}</div>
          <div className={styles.statLabel}>{msg.stats.calculators}</div>
        </Link>
      </div>

      <div className={styles.divider} />

      <div className={styles.section} id="categories">
        <div className={styles.sectionHeader}>
          <h2>{msg.sections.browseCategory}</h2>
        </div>
        <div className={styles.cards}>
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/categories/${cat.slug}`} className={styles.card}>
              <div className={`${styles.cardIcon} ${iconColorClass[cat.iconColor]}`}>
                {cat.icon}
              </div>
              <h3>{cat.name}</h3>
              <p>{msg.sections.categoryTermCount.replace("{count}", String(cat.count))}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section} id="terminology">
        <div className={styles.sectionHeader}>
          <h2>{msg.sections.commonTerms}</h2>
          <Link href="/terminology">{msg.sections.viewAllTerms}</Link>
        </div>
        <div className={styles.termList}>
          {terms.map((term) => (
            <div key={term.id} className={styles.termItem}>
              <div className={styles.termItemHeader}>
                <span className={styles.termName}>{pickLocalized(locale, term.name)}</span>
                <span className={styles.termCat}>{categoryLabel(term.category)}</span>
              </div>
              <p className={styles.termDef}>{pickLocalized(locale, term.definition)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.section} id="templates">
        <div className={styles.sectionHeader}>
          <h2>{msg.sections.applicationTemplates}</h2>
          <Link href="/templates">{msg.sections.browseAllTemplates}</Link>
        </div>
        <div className={styles.templateGrid}>
          {templates.map((tmpl) => (
            <Link key={tmpl.id} href={`/templates/${tmpl.id}`} className={styles.tmplCard}>
              <div
                className={styles.tmplPreview}
                style={{ background: tmpl.previewGradient }}
              >
                {tmpl.previewEmoji}
              </div>
              <div className={styles.tmplBody}>
                <h3>{pickLocalized(locale, tmpl.name)}</h3>
                <p>{pickLocalized(locale, tmpl.description)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
