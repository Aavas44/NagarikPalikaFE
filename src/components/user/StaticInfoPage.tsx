"use client";

import Link from "next/link";
import pageStyles from "@/app/user.module.css";
import emiStyles from "@/components/user/emi.module.css";

export type StaticInfoSection = {
  heading: string;
  paragraphs: string[];
};

type StaticInfoPageProps = {
  back: string;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  sections: StaticInfoSection[];
};

export function StaticInfoPage({
  back,
  title,
  subtitle,
  lastUpdated,
  sections,
}: StaticInfoPageProps) {
  return (
    <section className={pageStyles.infoPage}>
      <div className={`${pageStyles.infoPageInner} ${emiStyles.emiPageInner}`}>
        <Link href="/" className={pageStyles.calculatorBack}>
          ← {back}
        </Link>

        <header className={pageStyles.infoHeader}>
          <h1>{title}</h1>
          {subtitle ? <p className={pageStyles.calculatorSubtitle}>{subtitle}</p> : null}
          {lastUpdated ? <p className={pageStyles.infoLastUpdated}>{lastUpdated}</p> : null}
        </header>

        <div className={pageStyles.infoBody}>
          {sections.map((section) => (
            <section key={section.heading} className={pageStyles.infoSection}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
