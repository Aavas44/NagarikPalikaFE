"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  CONSIDERATION_CATEGORIES,
  considerationCategoryPath,
} from "@/lib/considerations";
import styles from "@/app/user.module.css";
import { useNavDropdown } from "./useNavDropdown";

export function ConsiderationsNavDropdown() {
  const { msg } = useLanguage();
  const { open, rootRef, triggerRef, toggle, onMouseEnter, onMouseLeave } = useNavDropdown();
  const labels = msg.considerations;

  return (
    <div
      ref={rootRef}
      className={`${styles.navDropdown} ${styles.navDropdownConsiderations} ${
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
        {msg.nav.considerations}
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
        {CONSIDERATION_CATEGORIES.map((category) => {
          const label = labels[category.labelKey];
          return (
            <Link
              key={category.slug}
              href={considerationCategoryPath(category.slug)}
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
          href="/considerations"
          className={styles.navDropdownItem}
          role="menuitem"
          title={msg.nav.allConsiderations}
        >
          {msg.nav.allConsiderations}
        </Link>
      </div>
    </div>
  );
}
