"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CalculatorsNavDropdown } from "./CalculatorsNavDropdown";
import styles from "@/app/user.module.css";

export function UserNav() {
  const { locale, setLocale, msg } = useLanguage();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.navLogo}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 10v11M16 10v11M12 10v11" />
        </svg>
        Nagarik Palika
      </Link>
      <div className={styles.navLinks}>
        <Link href="/terminology">{msg.nav.terminology}</Link>
        <a href="#templates">{msg.nav.templates}</a>
        <CalculatorsNavDropdown />
        <Link href="/consult">{msg.nav.consultLawyer}</Link>
        <a href="#faq">{msg.nav.faq}</a>
        <a href="#help">{msg.nav.help}</a>
      </div>
      <div className={styles.navRight}>
        <div className={styles.langToggle} role="group" aria-label={msg.language.toggle}>
          <button
            type="button"
            className={`${styles.langBtn} ${locale === "en" ? styles.langBtnActive : ""}`}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`${styles.langBtn} ${locale === "ne" ? styles.langBtnActive : ""}`}
            onClick={() => setLocale("ne")}
          >
            ने
          </button>
        </div>
        <Link href="/login" className={styles.navCta}>
          {msg.nav.signIn}
        </Link>
        <Link href="/login?intent=user" className={styles.navCta} style={{ background: "#3b6d11" }}>
          Book consult
        </Link>
      </div>
    </nav>
  );
}
