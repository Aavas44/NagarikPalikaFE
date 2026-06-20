"use client";

import { useLanguage } from "@/context/LanguageContext";
import { ContactSection } from "./ContactSection";
import styles from "@/app/user.module.css";

export function UserFooter() {
  const { msg } = useLanguage();

  return (
    <>
      <ContactSection />
      <footer className={styles.footer}>
        <p>{msg.footer.disclaimer}</p>
      </footer>
    </>
  );
}
