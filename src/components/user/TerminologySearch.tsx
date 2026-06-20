"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { NEPALI_INDEX_LETTERS } from "@/lib/glossaryIndex";
import type {
  GlossaryBrowseResponse,
  GlossarySearchResponse,
  GlossarySearchResult,
} from "@/types/glossary";
import styles from "@/app/user.module.css";

const BROWSE_PAGE_SIZE = 20;
const PAGE_WINDOW_RADIUS = 2;

type PaginationItem = { type: "page"; page: number } | { type: "ellipsis" };

/** Window around current page, plus first/last with ellipsis when there is a gap. */
function getPaginationItems(current: number, totalPages: number): PaginationItem[] {
  const windowStart = Math.max(1, current - PAGE_WINDOW_RADIUS);
  const windowEnd = Math.min(totalPages, current + PAGE_WINDOW_RADIUS);
  const items: PaginationItem[] = [];

  if (windowStart > 1) {
    items.push({ type: "page", page: 1 });
    if (windowStart > 2) items.push({ type: "ellipsis" });
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    items.push({ type: "page", page: p });
  }

  if (windowEnd < totalPages) {
    if (windowEnd < totalPages - 1) items.push({ type: "ellipsis" });
    items.push({ type: "page", page: totalPages });
  }

  return items;
}

function buildTerminologyUrl(params: {
  q?: string;
  letter?: string | null;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) {
    sp.set("q", params.q.trim());
  } else {
    if (params.letter) sp.set("letter", params.letter);
    if (params.page && params.page > 1) sp.set("page", String(params.page));
  }
  const qs = sp.toString();
  return `/terminology${qs ? `?${qs}` : ""}`;
}

interface TerminologySearchProps {
  glossaryTermsCount: number;
}

export function TerminologySearch({ glossaryTermsCount }: TerminologySearchProps) {
  const { locale, msg } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQuery = searchParams.get("q") ?? "";
  const urlLetter = searchParams.get("letter");
  const urlPage = Math.max(Number(searchParams.get("page")) || 1, 1);

  const [query, setQuery] = useState(urlQuery);
  const [searchResults, setSearchResults] = useState<GlossarySearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [browse, setBrowse] = useState<GlossaryBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveSearchRef = useRef(false);

  const isSearchMode = Boolean(query.trim());

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/glossary?q=${encodeURIComponent(trimmed)}&limit=30`);
      if (!res.ok) throw new Error("Search failed");
      const data = (await res.json()) as GlossarySearchResponse;
      setSearchResults(data.results);
      setSearchTotal(data.total);
      setExpandedIndex(null);
      setActiveIndex(-1);
    } catch {
      setSearchResults([]);
      setSearchTotal(0);
      setExpandedIndex(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const runBrowse = useCallback(async (letter: string | null, page: number) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: String(BROWSE_PAGE_SIZE),
      });
      if (letter) sp.set("letter", letter);
      const res = await fetch(`/api/glossary/browse?${sp}`);
      if (!res.ok) throw new Error("Browse failed");
      const data = (await res.json()) as GlossaryBrowseResponse;
      setBrowse(data);
      setExpandedIndex(null);
      setActiveIndex(-1);
    } catch {
      setBrowse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (liveSearchRef.current) return;
    if (urlQuery.trim()) {
      void runSearch(urlQuery);
      return;
    }
    void runBrowse(urlLetter, urlPage);
  }, [urlQuery, urlLetter, urlPage, runBrowse, runSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;

    liveSearchRef.current = true;
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const navigateBrowse = (letter: string | null, page: number) => {
    liveSearchRef.current = false;
    router.replace(buildTerminologyUrl({ letter, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleResult = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
    setActiveIndex(index);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    liveSearchRef.current = false;
    if (trimmed) {
      router.replace(buildTerminologyUrl({ q: trimmed }));
      return;
    }
    router.replace(buildTerminologyUrl({ letter: urlLetter, page: 1 }));
  };

  const handleQueryChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(value);
    if (!value.trim()) {
      liveSearchRef.current = false;
      setSearchResults([]);
      setSearchTotal(0);
      router.replace(buildTerminologyUrl({ letter: urlLetter, page: 1 }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const results = isSearchMode ? searchResults : (browse?.results ?? []);
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
  const displayResults = isSearchMode ? searchResults : (browse?.results ?? []);
  const displayTotal = isSearchMode ? searchTotal : (browse?.total ?? 0);

  const browseStart =
    browse && browse.total > 0 ? (browse.page - 1) * browse.limit + 1 : 0;
  const browseEnd = browse ? Math.min(browse.page * browse.limit, browse.total) : 0;

  const showBrowseChrome = !isSearchMode && browse;

  const renderResults = (results: GlossarySearchResult[]) => (
    <ul className={styles.terminologyResults} role="listbox" aria-label={t.title}>
      {results.map((result, index) => {
        const isExpanded = expandedIndex === index;
        const isActive = activeIndex === index;
        const meaning =
          result.source === "saralsewa"
            ? (result.meaningNe ?? result.meaning)
            : result.meaning;

        return (
          <li key={`${result.term}-${result.romanTransliteration}-${index}`}>
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
                {result.english && <p className={styles.terminologyEnglish}>{result.english}</p>}
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
  );

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
            onChange={(e) => handleQueryChange(e.target.value)}
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

      {showBrowseChrome && (
        <nav className={styles.terminologyIndex} aria-label={t.indexAll}>
          <button
            type="button"
            className={`${styles.terminologyIndexBtn} ${styles.terminologyIndexAll} ${
              !browse.letter ? styles.terminologyIndexBtnActive : ""
            }`}
            onClick={() => navigateBrowse(null, 1)}
          >
            {t.indexAll}
          </button>
          {NEPALI_INDEX_LETTERS.map((letter) => {
            const count = browse.indexCounts[letter] ?? 0;
            const isActive = browse.letter === letter;
            return (
              <button
                key={letter}
                type="button"
                disabled={count === 0}
                className={`${styles.terminologyIndexBtn} ${
                  isActive ? styles.terminologyIndexBtnActive : ""
                } ${count === 0 ? styles.terminologyIndexBtnDisabled : ""}`}
                onClick={() => navigateBrowse(letter, 1)}
                aria-label={`${letter} (${count})`}
                title={count > 0 ? String(count) : undefined}
              >
                {letter}
              </button>
            );
          })}
        </nav>
      )}

      {loading && (
        <p className={styles.terminologyStatus}>
          {isSearchMode ? t.searching : t.loadingBrowse}
        </p>
      )}

      {!loading && isSearchMode && query.trim() && searchResults.length === 0 && (
        <p className={styles.terminologyStatus}>{t.noResults}</p>
      )}

      {!loading && displayResults.length > 0 && (
        <div className={styles.terminologyResultsWrap}>
          <p className={styles.terminologyResultCount}>
            {isSearchMode
              ? t.resultsCount
                  .replace("{total}", String(displayTotal))
                  .replace("{shown}", String(displayResults.length))
              : t.browseRange
                  .replace("{start}", String(browseStart))
                  .replace("{end}", String(browseEnd))
                  .replace(
                    "{total}",
                    displayTotal.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")
                  )}
          </p>
          {renderResults(displayResults)}

          {showBrowseChrome && browse.totalPages > 1 && (
            <div className={styles.terminologyPagination}>
              <button
                type="button"
                className={styles.terminologyPageBtn}
                disabled={browse.page <= 1}
                onClick={() => navigateBrowse(browse.letter, browse.page - 1)}
              >
                {t.prevPage}
              </button>
              <div className={styles.terminologyPageJumpGroup}>
                {getPaginationItems(browse.page, browse.totalPages).map((item, index) =>
                  item.type === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className={styles.terminologyPageEllipsis}
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item.page}
                      type="button"
                      className={`${styles.terminologyPageBtn} ${
                        item.page === browse.page ? styles.terminologyPageBtnActive : ""
                      }`}
                      onClick={() => navigateBrowse(browse.letter, item.page)}
                      aria-current={item.page === browse.page ? "page" : undefined}
                      aria-label={
                        item.page === 1
                          ? t.firstPage
                          : item.page === browse.totalPages
                            ? t.lastPage
                            : undefined
                      }
                    >
                      {item.page.toLocaleString(locale === "ne" ? "ne-NP" : "en-NP")}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                className={styles.terminologyPageBtn}
                disabled={browse.page >= browse.totalPages}
                onClick={() => navigateBrowse(browse.letter, browse.page + 1)}
              >
                {t.nextPage}
              </button>
            </div>
          )}
        </div>
      )}

      <p className={styles.terminologySource}>{t.source}</p>
    </div>
  );
}
