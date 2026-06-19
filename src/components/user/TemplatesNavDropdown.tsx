"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import { getTemplates } from "@/lib/api";
import type { Template } from "@/types";
import styles from "@/app/user.module.css";
import { useNavDropdown } from "./useNavDropdown";

export function TemplatesNavDropdown() {
  const { locale, msg } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const { open, rootRef, triggerRef, toggle, onMouseEnter, onMouseLeave } = useNavDropdown();

  useEffect(() => {
    getTemplates({ status: "published" })
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${styles.navDropdown} ${styles.navDropdownTemplates} ${
        open ? styles.navDropdownOpen : ""
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.navLink} ${styles.navDropdownTrigger}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        {msg.nav.templates}
        <svg
          className={styles.navDropdownChevron}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={styles.navDropdownMenu} role="menu">
        {templates.map((tmpl) => {
          const label = pickLocalized(locale, tmpl.name);
          return (
            <Link
              key={tmpl.id}
              href={`/templates/${tmpl.id}`}
              className={styles.navDropdownItem}
              role="menuitem"
              title={label}
            >
              {label}
            </Link>
          );
        })}
        <div className={styles.navDropdownDivider} />
        <Link
          href="/templates"
          className={styles.navDropdownItem}
          role="menuitem"
          title={msg.nav.allTemplates}
        >
          {msg.nav.allTemplates}
        </Link>
      </div>
    </div>
  );
}
