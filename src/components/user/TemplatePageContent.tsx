"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import type { Template } from "@/types";
import { GharBatoSifarisForm } from "./GharBatoSifarisForm";
import styles from "@/app/user.module.css";

interface TemplatePageContentProps {
  template: Template;
}

export function TemplatePageContent({ template }: TemplatePageContentProps) {
  const { locale, msg } = useLanguage();
  const [copied, setCopied] = useState(false);
  const page = msg.templatesPage;
  const isGharBato = template.id === "ghar-bato-sifaris";

  const summary = [
    pickLocalized(locale, template.name),
    pickLocalized(locale, template.description),
    `${page.fileName}: ${template.fileName}`,
    `${page.fileType}: ${template.fileType.toUpperCase()}`,
  ].join("\n");

  async function handlePrint() {
    window.print();
  }

  async function handleCopy() {
    if (isGharBato) {
      const el = document.getElementById("template-document");
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.innerText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard unavailable */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className={styles.templatePage}>
      <div
        className={`${styles.templatePageInner} ${isGharBato ? styles.templatePageInnerWide : ""}`}
      >
        <Link href="/templates" className={styles.calculatorBack}>
          ← {page.allTemplates}
        </Link>

        <h1>{pickLocalized(locale, template.name)}</h1>
        <p className={styles.templateLead}>{pickLocalized(locale, template.description)}</p>

        {isGharBato ? (
          <>
            <div className={styles.templateActions}>
              <button type="button" className={styles.btnDl} onClick={handlePrint}>
                🖨 {page.print}
              </button>
              <button type="button" className={styles.btnCopy} onClick={handleCopy}>
                ⎘ {copied ? msg.templates.copied : page.copySummary}
              </button>
            </div>
            <p className={styles.templateFillHint}>{page.fillHint}</p>
            <div id="template-document" className={styles.templateDocumentWrap}>
              <GharBatoSifarisForm />
            </div>
          </>
        ) : (
          <>
            <div className={styles.templateActions}>
              <button type="button" className={styles.btnDl} disabled title={page.downloadHint}>
                ⬇ {msg.templates.download}
              </button>
              <button type="button" className={styles.btnCopy} onClick={handleCopy}>
                ⎘ {copied ? msg.templates.copied : page.copySummary}
              </button>
            </div>
            <p className={styles.templateHint}>{page.downloadHint}</p>
          </>
        )}

        <Link href="/" className={styles.templateHomeLink}>
          ← {page.back}
        </Link>
      </div>
    </section>
  );
}
