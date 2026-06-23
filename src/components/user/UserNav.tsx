"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CalculatorsNavDropdown } from "./CalculatorsNavDropdown";
import { ConsiderationsNavDropdown } from "./ConsiderationsNavDropdown";
import { TemplatesNavDropdown } from "./TemplatesNavDropdown";
import { UserMobileMenu } from "./UserMobileMenu";
import styles from "@/app/user.module.css";

export function UserNav() {
  const { locale, setLocale, msg } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <ConsiderationsNavDropdown />
        <CalculatorsNavDropdown />
        <Link href="/#faq" className={styles.navLink}>
          {msg.nav.faq}
        </Link>
        <Link href="/#contact" className={styles.navLink}>
          {msg.nav.contactUs}
        </Link>
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
        <button
          type="button"
          className={styles.navMenuBtn}
          aria-label={mobileMenuOpen ? msg.nav.menuClose : msg.nav.menuOpen}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <Link href="/login" className={styles.navCta}>
          {msg.nav.signIn}
        </Link>
      </div>
      <UserMobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </nav>
  );
}
