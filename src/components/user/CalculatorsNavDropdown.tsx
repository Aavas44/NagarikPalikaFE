"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import styles from "@/app/user.module.css";

export function CalculatorsNavDropdown() {
  const { msg } = useLanguage();

  return (
    <div className={styles.navDropdown}>
      <span
        className={styles.navDropdownTrigger}
        tabIndex={0}
        role="button"
        aria-haspopup="true"
      >
        {msg.nav.calculators}
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
      </span>
      <div className={styles.navDropdownMenu} role="menu">
        {CALCULATOR_ITEMS.map((item) => (
          <Link
            key={item.slug}
            href={`/calculators/${item.slug}`}
            className={styles.navDropdownItem}
            role="menuitem"
          >
            {msg.calculators[item.labelKey]}
          </Link>
        ))}
      </div>
    </div>
  );
}
