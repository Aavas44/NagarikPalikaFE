"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import { getCalculatorCount, FEATURED_CALCULATOR_SLUG } from "@/lib/calculators";
import type { Stats, Template } from "@/types";
import type { SaralSewaCategoryCard } from "@/types/saralsewa";
import pageStyles from "@/app/user.module.css";
import emiStyles from "./emi.module.css";

const iconColorClass: Record<SaralSewaCategoryCard["iconColor"], string> = {
  blue: pageStyles.cardIconBlue,
  green: pageStyles.cardIconGreen,
  amber: pageStyles.cardIconAmber,
  teal: pageStyles.cardIconTeal,
};

interface UserHomeProps {
  stats: Stats;
  glossaryTermsCount: number;
  categories: SaralSewaCategoryCard[];
  templates: Template[];
}

export function UserHome({ stats, glossaryTermsCount, categories, templates }: UserHomeProps) {
  const { locale, msg } = useLanguage();

  return (
    <>
      <div className={emiStyles.homeStatGrid}>
          <Link href="/terminology" className={`${emiStyles.emiFadeCard} ${emiStyles.homeStatCard}`}>
            <span className={emiStyles.homeStatValue}>
              {glossaryTermsCount.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")}
            </span>
            <span className={emiStyles.homeStatLabel}>{msg.stats.terms}</span>
          </Link>
          <Link href="/templates" className={`${emiStyles.emiFadeCard} ${emiStyles.homeStatCard}`}>
            <span className={emiStyles.homeStatValue}>{stats.templatesCount}+</span>
            <span className={emiStyles.homeStatLabel}>{msg.stats.templates}</span>
          </Link>
          <Link href="/calculators" className={`${emiStyles.emiFadeCard} ${emiStyles.homeStatCard}`}>
            <span className={emiStyles.homeStatValue}>{getCalculatorCount()}</span>
            <span className={emiStyles.homeStatLabel}>{msg.stats.calculators}</span>
          </Link>
        </div>

        <section className={emiStyles.siteSection} id="calculators">
          <div className={emiStyles.siteSectionHeader}>
            <h2 className={emiStyles.siteSectionTitle}>{msg.sections.featuredCalculators}</h2>
            <Link href="/calculators" className={emiStyles.siteSectionLink}>
              {msg.calculators.back}
            </Link>
          </div>
          <div className={emiStyles.siteHubGrid}>
            <Link
              href={`/calculators/${FEATURED_CALCULATOR_SLUG}`}
              className={`${emiStyles.emiFadeCard} ${emiStyles.siteHubCard} ${emiStyles.siteHubCardFeatured}`}
            >
              <span className={emiStyles.siteFeaturedBadge}>{msg.sections.featuredBadge}</span>
              <div className={`${emiStyles.siteHubIcon} ${iconColorClass.blue}`}>💰</div>
              <h3>{msg.calculators.salaryTax}</h3>
              <p>{msg.calculators.salaryTaxDesc}</p>
            </Link>
            <Link
              href="/calculators/vehicle-tax"
              className={`${emiStyles.emiFadeCard} ${emiStyles.siteHubCard}`}
            >
              <div className={`${emiStyles.siteHubIcon} ${iconColorClass.amber}`}>🚗</div>
              <h3>{msg.calculators.vehicleTax}</h3>
              <p>{msg.calculators.vehicleTaxDesc}</p>
            </Link>
            <Link
              href="/calculators/emi"
              className={`${emiStyles.emiFadeCard} ${emiStyles.siteHubCard}`}
            >
              <div className={`${emiStyles.siteHubIcon} ${iconColorClass.teal}`}>🏦</div>
              <h3>{msg.calculators.emi}</h3>
              <p>{msg.calculators.emiDesc}</p>
            </Link>
          </div>
        </section>

        <section className={emiStyles.siteSection} id="categories">
          <div className={emiStyles.siteSectionHeader}>
            <h2 className={emiStyles.siteSectionTitle}>{msg.sections.browseCategory}</h2>
          </div>
          <div className={emiStyles.siteHubGrid}>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className={`${emiStyles.emiFadeCard} ${emiStyles.siteHubCard}`}
              >
                <div className={`${emiStyles.siteHubIcon} ${iconColorClass[cat.iconColor]}`}>
                  {cat.icon}
                </div>
                <h3>{cat.name}</h3>
                <p>{msg.sections.categoryTermCount.replace("{count}", String(cat.count))}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={emiStyles.siteSection} id="templates">
          <div className={emiStyles.siteSectionHeader}>
            <h2 className={emiStyles.siteSectionTitle}>{msg.sections.applicationTemplates}</h2>
            <Link href="/templates" className={emiStyles.siteSectionLink}>
              {msg.sections.browseAllTemplates}
            </Link>
          </div>
          <div className={emiStyles.siteTemplateGrid}>
            {templates.map((tmpl) => (
              <Link
                key={tmpl.id}
                href={`/templates/${tmpl.id}`}
                className={`${emiStyles.emiFadeCard} ${emiStyles.siteTemplateCard}`}
              >
                <div
                  className={emiStyles.siteTemplatePreview}
                  style={{ background: tmpl.previewGradient }}
                >
                  {tmpl.previewEmoji}
                </div>
                <div className={emiStyles.siteTemplateBody}>
                  <h3>{pickLocalized(locale, tmpl.name)}</h3>
                  <p>{pickLocalized(locale, tmpl.description)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
    </>
  );
}
