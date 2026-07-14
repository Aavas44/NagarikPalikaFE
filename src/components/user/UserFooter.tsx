"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { ContactSection } from "./ContactSection";
import styles from "@/app/user.module.css";

type UserFooterProps = {
  /** When false, omit the contact form (e.g. Sajilo Kanun app pages). */
  showContact?: boolean;
};

export function UserFooter({ showContact = true }: UserFooterProps) {
  const { msg } = useLanguage();

  return (
    <>
      {showContact ? <ContactSection /> : null}
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
