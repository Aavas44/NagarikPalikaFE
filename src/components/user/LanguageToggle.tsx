"use client";

import { useId } from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/user.module.css";

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.8 6.2 3.8 9s-1.3 6.2-3.8 9M12 3c-2.5 2.8-3.8 6.2-3.8 9s1.3 6.2 3.8 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

interface LanguageToggleProps {
  layout?: "inline" | "stacked";
}

export function LanguageToggle({ layout = "inline" }: LanguageToggleProps) {
  const { locale, setLocale, msg } = useLanguage();
  const labelId = useId();
  const wrapClass = layout === "stacked" ? styles.langToggleStacked : styles.langToggleWrap;

  return (
    <div className={wrapClass}>
      <span className={styles.langToggleLabel} id={labelId}>
        <GlobeIcon />
        <span className={styles.langToggleLabelText}>{msg.language.toggle}</span>
      </span>
      <div
        className={styles.langToggle}
        role="group"
        aria-labelledby={labelId}
      >
        <button
          type="button"
          className={`${styles.langBtn} ${locale === "en" ? styles.langBtnActive : ""}`}
          onClick={() => setLocale("en")}
          aria-pressed={locale === "en"}
        >
          {msg.language.en}
        </button>
        <button
          type="button"
          className={`${styles.langBtn} ${locale === "ne" ? styles.langBtnActive : ""}`}
          onClick={() => setLocale("ne")}
          aria-pressed={locale === "ne"}
        >
          {msg.language.ne}
        </button>
      </div>
    </div>
  );
}
