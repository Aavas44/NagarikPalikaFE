"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import type { Template } from "@/types";
import styles from "@/app/user.module.css";

interface TemplatesListContentProps {
  templates: Template[];
}

export function TemplatesListContent({ templates }: TemplatesListContentProps) {
  const { locale, msg } = useLanguage();

  return (
    <section className={styles.templatePage}>
      <div className={styles.templatePageInner}>
        <Link href="/" className={styles.calculatorBack}>
          ← {msg.templatesPage.back}
        </Link>
        <h1>{msg.templatesPage.allTemplates}</h1>
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
    </section>
  );
}
