"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { CategoryTerms } from "@/components/user/CategoryTerms";
import type { SaralSewaCategoryCard, SaralSewaEntry } from "@/types/saralsewa";
import styles from "@/app/user.module.css";

const iconColorClass = {
  blue: styles.cardIconBlue,
  green: styles.cardIconGreen,
  amber: styles.cardIconAmber,
  teal: styles.cardIconTeal,
} as const;

interface CategoryPageContentProps {
  category: SaralSewaCategoryCard;
  entries: SaralSewaEntry[];
}

export function CategoryPageContent({ category, entries }: CategoryPageContentProps) {
  const { msg } = useLanguage();

  return (
    <main className={styles.categoryPage}>
      <Link href="/#categories" className={styles.categoryBackLink}>
        ← {msg.categoriesPage.back}
      </Link>

      <header className={styles.categoryPageHeader}>
        <div className={`${styles.cardIcon} ${iconColorClass[category.iconColor]}`}>
          {category.icon}
        </div>
        <div>
          <h1>{category.name}</h1>
          <p>
            {msg.sections.categoryTermCount.replace("{count}", String(category.count))} ·
            SaralSewa
          </p>
        </div>
      </header>

      <CategoryTerms entries={entries} />
    </main>
  );
}
