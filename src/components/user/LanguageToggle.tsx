"use client";

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
  const { locale, toggleLocale, msg } = useLanguage();
  const wrapClass =
    layout === "stacked" ? styles.langToggleStacked : styles.langToggleWrap;
  const nextLocale = locale === "en" ? "ne" : "en";
  const nextLabel = nextLocale === "en" ? msg.language.en : msg.language.ne;
  const currentLabel = locale === "en" ? msg.language.en : msg.language.ne;

  return (
    <div className={wrapClass}>
      <button
        type="button"
        className={styles.langSwitch}
        onClick={toggleLocale}
        aria-label={`${msg.language.toggle}: ${currentLabel}. ${nextLabel}`}
        title={`${msg.language.toggle}: ${currentLabel}`}
      >
        <span className={styles.langSwitchIcon}>
          <GlobeIcon />
        </span>
        <span className={styles.langSwitchTrack} data-locale={locale}>
          <span
            className={`${styles.langSwitchOption} ${
              locale === "en" ? styles.langSwitchOptionActive : ""
            }`}
          >
            EN
          </span>
          <span
            className={`${styles.langSwitchOption} ${
              locale === "ne" ? styles.langSwitchOptionActive : ""
            }`}
          >
            ने
          </span>
          <span className={styles.langSwitchThumb} aria-hidden />
        </span>
      </button>
    </div>
  );
}
