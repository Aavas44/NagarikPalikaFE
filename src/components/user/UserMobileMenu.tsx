"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import {
  CONSIDERATION_CATEGORIES,
  considerationCategoryPath,
} from "@/lib/considerations";
import { pickLocalized } from "@/i18n/messages";
import { getTemplates } from "@/lib/api";
import type { Template } from "@/types";
import styles from "@/app/user.module.css";

interface UserMobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function UserMobileMenu({ open, onClose }: UserMobileMenuProps) {
  const { locale, msg } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!open) return;
    getTemplates({ status: "published" })
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const considerationLabels = msg.considerations;

  return (
    <div className={styles.navMobileRoot} role="presentation">
      <button
        type="button"
        className={styles.navMobileBackdrop}
        aria-label={msg.nav.menuClose}
        onClick={onClose}
      />
      <div
        id="mobile-nav-panel"
        className={styles.navMobilePanel}
        role="dialog"
        aria-modal="true"
        aria-label={msg.nav.navigation}
      >
        <div className={styles.navMobileHeader}>
          <span className={styles.navMobileTitle}>{msg.nav.navigation}</span>
          <button
            type="button"
            className={styles.navMobileClose}
            aria-label={msg.nav.menuClose}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className={styles.navMobileLinks} onClick={onClose}>
          <Link href="/terminology" className={styles.navMobileLink}>
            {msg.nav.terminology}
          </Link>

          <div className={styles.navMobileGroup}>
            <p className={styles.navMobileGroupLabel}>{msg.nav.templates}</p>
            {templates.map((tmpl) => (
              <Link
                key={tmpl.id}
                href={`/templates/${tmpl.id}`}
                className={styles.navMobileSublink}
              >
                {pickLocalized(locale, tmpl.name)}
              </Link>
            ))}
            <Link href="/templates" className={styles.navMobileSublinkAccent}>
              {msg.nav.allTemplates}
            </Link>
          </div>

          <div className={styles.navMobileGroup}>
            <p className={styles.navMobileGroupLabel}>{msg.nav.considerations}</p>
            {CONSIDERATION_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={considerationCategoryPath(category.slug)}
                className={styles.navMobileSublink}
              >
                {considerationLabels[category.labelKey]}
              </Link>
            ))}
            <Link href="/considerations" className={styles.navMobileSublinkAccent}>
              {msg.nav.allConsiderations}
            </Link>
          </div>

          <div className={styles.navMobileGroup}>
            <p className={styles.navMobileGroupLabel}>{msg.nav.calculators}</p>
            {CALCULATOR_ITEMS.map((item) => {
              const label = msg.calculators[item.labelKey];
              return (
                <Link
                  key={item.slug}
                  href={`/calculators/${item.slug}`}
                  className={styles.navMobileSublink}
                >
                  {label}
                </Link>
              );
            })}
            <Link href="/calculators" className={styles.navMobileSublinkAccent}>
              {msg.nav.allCalculators}
            </Link>
          </div>

          <Link href="/#faq" className={styles.navMobileLink}>
            {msg.nav.faq}
          </Link>
          <Link href="/#contact" className={styles.navMobileLink}>
            {msg.nav.contactUs}
          </Link>
          <Link href="/login" className={styles.navMobileCta}>
            {msg.nav.signIn}
          </Link>
        </nav>
      </div>
    </div>
  );
}
