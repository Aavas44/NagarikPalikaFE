"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import {
  hasSajiloKanunToken,
  sajiloKanunPostLoginPath,
} from "@/lib/sajilokanun-access";
import { getToken, getUserTypeFromToken } from "@/lib/auth";
import pageStyles from "@/app/user.module.css";
import styles from "./SajiloKanunLanding.module.css";

const LOGIN = "/sajilokanun/login";
const DEMO = "/sajilokanun/login#demo";

const FEATURE_ICONS = ["quote", "books", "files", "draft", "pesi", "team"] as const;

function FeatureIcon({ name }: { name: (typeof FEATURE_ICONS)[number] }) {
  const accent = name === "draft" || name === "pesi";
  return (
    <span className={`${styles.featureIcon} ${accent ? styles.featureIconAccent : ""}`} aria-hidden>
      {name === "quote" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M7 17h4l2-6V7H5v4h4l-2 6Zm8 0h4l2-6V7h-8v4h4l-2 6Z" fill="currentColor" />
        </svg>
      )}
      {name === "books" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 4.5A1.5 1.5 0 0 1 6.5 3H20v16H6.5A1.5 1.5 0 0 0 5 20.5V4.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M5 20.5A1.5 1.5 0 0 1 6.5 19H20" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
      {name === "files" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 3.75h6.5L19 9.25V20.25H7V3.75Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M13.5 3.75V9.25H19" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
      {name === "draft" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 19.5 14.5 10 17 12.5 7.5 22H5v-2.5ZM16 8.5l2.5-2.5L21 8.5 18.5 11 16 8.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {name === "pesi" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
      {name === "team" && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M4.5 18c.6-2.6 2.6-4 4.5-4s3.9 1.4 4.5 4M13.5 14.2c1.5.2 3.2 1.3 3.8 3.8"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

export function SajiloKanunLanding() {
  const { msg } = useLanguage();
  const t = msg.sajilokanun.landing;
  const [workspaceHref, setWorkspaceHref] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (hasSajiloKanunToken()) {
      setWorkspaceHref(sajiloKanunPostLoginPath());
      return;
    }
    const token = getToken();
    if (token && getUserTypeFromToken(token) === "wardOperator") {
      setWorkspaceHref("/ward");
    }
  }, []);

  const primaryHref = workspaceHref ?? LOGIN;
  const primaryLabel = workspaceHref ? t.ctaOpen : t.ctaSignIn;

  return (
    <>
      <UserNav />
      <main className={styles.page}>
        <div className={styles.inner}>
          <nav className={styles.productNav} aria-label={msg.nav.sajiloKanun}>
            <a href="#features">{t.navFeatures}</a>
            <a href="#how">{t.navHow}</a>
            <a href="#faq">{t.navFaq}</a>
            <Link href={primaryHref}>{primaryLabel}</Link>
            {!workspaceHref ? <Link href={DEMO}>{t.ctaDemo}</Link> : null}
          </nav>

          <header className={styles.hero}>
            <div className={styles.mark} aria-hidden>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v3M6.5 8.5 12 6l5.5 2.5M6.5 8.5 12 21M17.5 8.5 12 21M4 10.5h3.5M16.5 10.5H20"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.badge}>{t.badge}</p>
            <h1>
              <span className={styles.brand}>{t.titleLead}</span>
              <br />
              {t.titleRest}
            </h1>
            <p className={styles.lead}>{t.subtitle}</p>
            <div className={styles.ctaRow}>
              <Link href={primaryHref} className={styles.primaryCta}>
                {primaryLabel}
                <span aria-hidden>→</span>
              </Link>
              {!workspaceHref ? (
                <Link href={DEMO} className={styles.secondaryCta}>
                  {t.ctaDemo}
                </Link>
              ) : null}
            </div>
            <p className={styles.accessNote}>{t.accessNote}</p>
          </header>

          <section className={styles.section} aria-labelledby="pain-title">
            <p className={styles.sectionEyebrow}>{t.painEyebrow}</p>
            <h2 id="pain-title">{t.painTitle}</h2>
            <p className={styles.sectionLead}>{t.painLead}</p>
            <div className={styles.painGrid}>
              {t.pains.map((pain) => (
                <article key={pain.title} className={styles.painCard}>
                  <h3>{pain.title}</h3>
                  <p>{pain.body}</p>
                </article>
              ))}
              <article className={styles.wayCard}>
                <h3>{t.wayTitle}</h3>
                <ul>
                  {t.wayItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className={styles.section} id="features" aria-labelledby="features-title">
            <h2 id="features-title">{t.featuresTitle}</h2>
            <p className={styles.sectionLead}>{t.featuresLead}</p>
            <div className={styles.featureGrid}>
              {t.features.map((feature, i) => (
                <article key={feature.title} className={styles.featureCard}>
                  <FeatureIcon name={FEATURE_ICONS[i] ?? "quote"} />
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} aria-labelledby="books-title">
            <h2 id="books-title">{t.booksTitle}</h2>
            <div className={styles.books}>
              {t.books.map((title) => (
                <span key={title} className={styles.bookChip}>
                  {title}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section} id="how" aria-labelledby="how-title">
            <h2 id="how-title">{t.howTitle}</h2>
            <div className={styles.steps}>
              {t.howSteps.map((step, i) => (
                <article key={step.title} className={styles.step}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section} id="faq" aria-labelledby="faq-title">
            <h2 id="faq-title">{t.faqTitle}</h2>
            <p className={styles.faqLead}>{t.faqLead}</p>
            <div className={pageStyles.faqList}>
              {t.faqItems.map((item, i) => (
                <div key={item.q} className={pageStyles.faqItem}>
                  <button
                    type="button"
                    className={pageStyles.faqQuestion}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    {item.q}
                    <span className={pageStyles.faqToggle}>{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i ? <p className={pageStyles.faqAnswer}>{item.a}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.ctaBand} aria-labelledby="sk-cta-title">
            <h2 id="sk-cta-title">{t.ctaTitle}</h2>
            <p>{t.ctaLead}</p>
            <div className={styles.ctaRow}>
              <Link href={primaryHref} className={styles.primaryCta}>
                {primaryLabel}
                <span aria-hidden>→</span>
              </Link>
              {!workspaceHref ? (
                <Link href={DEMO} className={styles.secondaryCta}>
                  {t.ctaDemo}
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <UserFooter />
    </>
  );
}
