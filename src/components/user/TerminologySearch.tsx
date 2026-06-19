"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import type { GlossarySearchResponse, GlossarySearchResult } from "@/types/glossary";
import styles from "@/app/user.module.css";

export function TerminologySearch({ glossaryTermsCount }: { glossaryTermsCount: number }) {
  const { locale, msg } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlossarySearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setExpandedIndex(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/glossary?q=${encodeURIComponent(trimmed)}&limit=30`);
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as GlossarySearchResponse;
      setResults(data.results);
      setTotal(data.total);
      setExpandedIndex(null);
      setActiveIndex(-1);
    } catch {
      setResults([]);
      setTotal(0);
      setExpandedIndex(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      void runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const toggleResult = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
    setActiveIndex(index);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.replace(`/terminology${params.toString() ? `?${params}` : ""}`);
    if (results.length === 1) {
      setExpandedIndex(0);
    } else if (activeIndex >= 0) {
      setExpandedIndex(activeIndex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      setExpandedIndex(activeIndex);
    } else if (e.key === "Escape") {
      setExpandedIndex(null);
      setActiveIndex(-1);
    }
  };

  const t = msg.terminology;
  const formattedCount = glossaryTermsCount.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP");

  return (
    <div className={styles.terminologyPage}>
      <header className={styles.terminologyHeader}>
        <h1>{t.title}</h1>
        <p>{t.subtitle.replace("{count}", formattedCount)}</p>
        <form className={styles.searchBar} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            autoComplete="off"
            autoFocus
          />
          <button type="submit" aria-label={t.search}>
            →
          </button>
        </form>
        <p className={styles.terminologyHint}>{t.searchHint}</p>
      </header>

      {loading && query.trim() && (
        <p className={styles.terminologyStatus}>{t.searching}</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className={styles.terminologyStatus}>{t.noResults}</p>
      )}

      {!loading && results.length > 0 && (
        <div className={styles.terminologyResultsWrap}>
          <p className={styles.terminologyResultCount}>
            {t.resultsCount
              .replace("{total}", String(total))
              .replace("{shown}", String(results.length))}
          </p>
          <ul className={styles.terminologyResults} role="listbox" aria-label={t.title}>
            {results.map((result, index) => {
              const isExpanded = expandedIndex === index;
              const isActive = activeIndex === index;
              const meaning =
                result.source === "saralsewa"
                  ? (result.meaningNe ?? result.meaning)
                  : result.meaning;

              return (
                <li key={`${result.term}-${index}`}>
                  <div
                    className={`${styles.terminologyResultCard} ${
                      isExpanded ? styles.terminologyResultExpanded : ""
                    } ${isActive && !isExpanded ? styles.terminologyResultActive : ""}`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-expanded={isExpanded}
                      aria-selected={isExpanded}
                      className={styles.terminologyResultTrigger}
                      onClick={() => toggleResult(index)}
                    >
                      <div className={styles.termItemHeader}>
                        <span className={styles.termName}>{result.term}</span>
                        <span className={styles.termCat}>{result.romanTransliteration}</span>
                      </div>
                      {result.english && (
                        <p className={styles.terminologyEnglish}>{result.english}</p>
                      )}
                    </button>

                    {isExpanded && (
                      <div className={styles.terminologyDetailInline} aria-live="polite">
                        <h3>{locale === "ne" ? t.meaningLabelNe : t.meaningLabelEn}</h3>
                        <p>{meaning}</p>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className={styles.terminologySource}>{t.source}</p>
    </div>
  );
}
