"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { pickLocalized } from "@/i18n/messages";
import type { QuickTag } from "@/types";
import styles from "@/app/user.module.css";

interface HeroProps {
  quickTags: QuickTag[];
}

export function Hero({ quickTags }: HeroProps) {
  const { locale, msg } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/terminology?q=${encodeURIComponent(q)}` : "/terminology");
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroBadge}>✓ {msg.hero.badge}</div>
      <h1>
        {msg.hero.titleLine1}
        <br />
        {msg.hero.titleLine2}
      </h1>
      <p>{msg.hero.subtitle}</p>
      <form className={styles.searchBar} onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={msg.hero.searchPlaceholder}
        />
        <button type="submit" aria-label={msg.terminology.search}>
          →
        </button>
      </form>
      <div className={styles.quickTags}>
        {quickTags.map((tag) => {
          const label = pickLocalized(locale, tag);
          return (
            <Link
              key={tag.ne}
              href={`/terminology?q=${encodeURIComponent(label)}`}
              className={styles.tag}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
