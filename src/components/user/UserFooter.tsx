"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { ContactSection } from "./ContactSection";
import styles from "@/app/user.module.css";

export function UserFooter() {
  const { msg } = useLanguage();

  return (
    <>
      <ContactSection />
      <footer className={styles.footer}>
        <nav className={styles.footerLinks} aria-label="Site links">
          <Link href="/about">{msg.footer.about}</Link>
          <Link href="/terms">{msg.footer.terms}</Link>
          <Link href="/#contact">{msg.footer.contact}</Link>
        </nav>
        <p>{msg.footer.disclaimer}</p>
      </footer>
    </>
  );
}
