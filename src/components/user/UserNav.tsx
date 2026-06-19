"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CalculatorsNavDropdown } from "./CalculatorsNavDropdown";
import { TemplatesNavDropdown } from "./TemplatesNavDropdown";
import styles from "@/app/user.module.css";

export function UserNav() {
  const { locale, setLocale, msg } = useLanguage();

  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.navLogo}>
        <Image
          src="/nagarik-palika-logo.png"
          alt="Nagarik Palika"
          width={188}
          height={88}
          className={styles.navLogoImage}
          priority
        />
      </Link>
      <div className={styles.navLinks}>
        <Link href="/terminology" className={styles.navLink}>
          {msg.nav.terminology}
        </Link>
        <TemplatesNavDropdown />
        <CalculatorsNavDropdown />
        <Link href="/consult" className={styles.navLink}>
          {msg.nav.consultLawyer}
        </Link>
        <a href="#faq" className={styles.navLink}>
          {msg.nav.faq}
        </a>
        <a href="#help" className={styles.navLink}>
          {msg.nav.help}
        </a>
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
        <Link href="/login?intent=user" className={`${styles.navCta} ${styles.navCtaAccent}`}>
          Book consult
        </Link>
      </div>
    </nav>
  );
}
