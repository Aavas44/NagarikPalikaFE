"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/user.module.css";

export function UserFooter() {
  const { msg } = useLanguage();

  return (
    <footer className={styles.footer} id="help">
      <p>{msg.footer.disclaimer}</p>
      <p style={{ marginTop: 8 }}>
        <a href="#">{msg.footer.privacy}</a> · <a href="#">{msg.footer.terms}</a> ·{" "}
        <a href="#">{msg.footer.contact}</a> · <a href="#">{msg.footer.accessibility}</a>
      </p>
    </footer>
  );
}
