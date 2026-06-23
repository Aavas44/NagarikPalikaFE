import { messages } from "@/i18n/messages";
import {
  getSalaryTaxSlabRows208283Couple,
  getSalaryTaxSlabRows208283Individual,
  getSalaryTaxSlabRows208384,
  type SalaryTaxSlabRow,
} from "@/lib/salaryTax";
import styles from "./emi.module.css";

type SalaryTaxSeoCopy = (typeof messages.en.calculators)["salaryTaxSeo"] | (typeof messages.ne.calculators)["salaryTaxSeo"];

function SlabTable({
  slabs,
  rangeLabel,
  rateLabel,
}: {
  slabs: SalaryTaxSlabRow[];
  rangeLabel: string;
  rateLabel: string;
}) {
  return (
    <div className={styles.emiTableWrap}>
      <table className={styles.emiTable}>
        <thead>
          <tr>
            <th>{rangeLabel}</th>
            <th>{rateLabel}</th>
          </tr>
        </thead>
        <tbody>
          {slabs.map((slab, index) => (
            <tr
              key={slab.rangeLabel}
              className={index % 2 === 0 ? styles.emiTableRowAlt : undefined}
            >
              <td>{slab.rangeLabel}</td>
              <td>
                {slab.rateLabel}
                {slab.note ? ` (${slab.note})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SalaryTaxSeoArticle({
  lang,
  seo,
  showLangLabel,
}: {
  lang: "en" | "ne";
  seo: SalaryTaxSeoCopy;
  showLangLabel: boolean;
}) {
  const slabs208384 = getSalaryTaxSlabRows208384();
  const slabs208283Individual = getSalaryTaxSlabRows208283Individual();
  const slabs208283Couple = getSalaryTaxSlabRows208283Couple();

  return (
    <article lang={lang} className={styles.salaryTaxSeoArticle}>
      {showLangLabel && (
        <p className={styles.salaryTaxSeoLangLabel}>
          {lang === "en" ? "English" : seo.nepaliHeading}
        </p>
      )}
      <h2 className={styles.salaryTaxSeoTitle}>{seo.h1}</h2>
      <p className={styles.salaryTaxSeoIntro}>{seo.intro}</p>

      <h3 className={styles.salaryTaxSeoHeading}>{seo.howTitle}</h3>
      <p className={styles.salaryTaxSeoText}>{seo.howBody}</p>

      <h3 className={styles.salaryTaxSeoHeading}>{seo.slabsTitle208384}</h3>
      <SlabTable slabs={slabs208384} rangeLabel={seo.slabRange} rateLabel={seo.slabRate} />

      <h3 className={styles.salaryTaxSeoHeading}>{seo.slabsTitle208283Individual}</h3>
      <SlabTable
        slabs={slabs208283Individual}
        rangeLabel={seo.slabRange}
        rateLabel={seo.slabRate}
      />

      <h3 className={styles.salaryTaxSeoHeading}>{seo.slabsTitle208283Couple}</h3>
      <p className={styles.salaryTaxSeoText}>{seo.slabsNote}</p>
      <SlabTable slabs={slabs208283Couple} rangeLabel={seo.slabRange} rateLabel={seo.slabRate} />

      <h3 className={styles.salaryTaxSeoHeading}>{seo.deductionsTitle}</h3>
      <ul className={styles.salaryTaxSeoList}>
        {seo.deductions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h3 className={styles.salaryTaxSeoHeading}>{seo.faqTitle}</h3>
      <dl className={styles.salaryTaxSeoFaq}>
        {seo.faq.map((item) => (
          <div key={item.q} className={styles.salaryTaxSeoFaqItem}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/** Server-rendered guide + FAQ for search engines (English and Nepali). */
export function SalaryTaxSeoContent() {
  return (
    <section
      id="salary-tax-guide"
      className={styles.salaryTaxSeo}
      aria-label="Salary tax calculator guide"
    >
      <SalaryTaxSeoArticle lang="en" seo={messages.en.calculators.salaryTaxSeo} showLangLabel={false} />
      <div className={styles.salaryTaxSeoDivider} role="presentation" />
      <SalaryTaxSeoArticle
        lang="ne"
        seo={messages.ne.calculators.salaryTaxSeo}
        showLangLabel
      />
    </section>
  );
}
