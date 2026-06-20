"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CALCULATOR_ITEMS } from "@/lib/calculators";
import styles from "@/app/user.module.css";
import { useNavDropdown } from "./useNavDropdown";

export function CalculatorsNavDropdown() {
  const { msg } = useLanguage();
  const { open, rootRef, triggerRef, toggle, onMouseEnter, onMouseLeave } = useNavDropdown();

  return (
    <div
      ref={rootRef}
      className={`${styles.navDropdown} ${styles.navDropdownCalculators} ${
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
      </button>
      <div className={styles.navDropdownMenu} role="menu">
        {CALCULATOR_ITEMS.map((item) => {
          const label = msg.calculators[item.labelKey];
          return (
            <Link
              key={item.slug}
              href={`/calculators/${item.slug}`}
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
          href="/calculators"
          className={styles.navDropdownItem}
          role="menuitem"
          title={msg.nav.allCalculators}
        >
          {msg.nav.allCalculators}
        </Link>
      </div>
    </div>
  );
}
