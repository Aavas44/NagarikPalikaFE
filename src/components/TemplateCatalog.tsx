"use client";

import styles from "./TemplateCatalog.module.css";

export type TemplateCatalogItem = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  starred: boolean;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export type TemplateCatalogLabels = {
  searchLabel: string;
  searchPlaceholder: string;
  all: string;
  starred: string;
  empty: string;
  noResults: string;
  loading?: string;
  starLabel: string;
  unstarLabel: string;
  prev: string;
  next: string;
  openHint?: string;
};

type TemplateCatalogProps = {
  items: TemplateCatalogItem[];
  /** Items after search/star filter (for count + pagination math). */
  filteredCount: number;
  /** Total available before search (for empty vs no-results). */
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  showStarredOnly: boolean;
  onShowStarredOnlyChange: (value: boolean) => void;
  starredCount: number;
  labels: TemplateCatalogLabels;
  loading?: boolean;
  error?: string | null;
  onToggleStar: (id: string) => void;
  onSelect: (id: string) => void;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
      <path
        d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9 13h6M9 17h4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
      <path
        d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TemplateCatalog({
  items,
  filteredCount,
  totalCount,
  search,
  onSearchChange,
  page,
  pageSize,
  onPageChange,
  showStarredOnly,
  onShowStarredOnlyChange,
  starredCount,
  labels,
  loading = false,
  error = null,
  onToggleStar,
  onSelect,
}: TemplateCatalogProps) {
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize) || 1);
  const activePage = Math.min(page, totalPages);
  const rangeStart = filteredCount === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(activePage * pageSize, filteredCount);

  return (
    <div className={styles.catalog}>
      <div className={styles.toolbar}>
        <div className={styles.searchShell}>
          <span className={styles.searchIcon} aria-hidden>
            <SearchIcon />
          </span>
          <label className={styles.srOnly} htmlFor="template-catalog-search">
            {labels.searchLabel}
          </label>
          <input
            id="template-catalog-search"
            className={styles.searchInput}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={labels.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          {search ? (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className={styles.filterRow} role="tablist" aria-label="Template filters">
          <button
            type="button"
            role="tab"
            aria-selected={!showStarredOnly}
            className={`${styles.filterChip} ${!showStarredOnly ? styles.filterChipOn : ""}`}
            onClick={() => onShowStarredOnlyChange(false)}
          >
            {labels.all}
            <span className={styles.filterCount}>{totalCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showStarredOnly}
            className={`${styles.filterChip} ${showStarredOnly ? styles.filterChipOn : ""}`}
            onClick={() => onShowStarredOnlyChange(true)}
          >
            <StarIcon filled />
            {labels.starred}
            <span className={styles.filterCount}>{starredCount}</span>
          </button>
        </div>
      </div>

      <div className={styles.metaRow}>
        <p className={styles.resultMeta}>
          {loading
            ? labels.loading || "…"
            : search.trim()
              ? `${filteredCount} · “${search.trim()}”`
              : showStarredOnly
                ? `${filteredCount} ${labels.starred.toLowerCase()}`
                : `${filteredCount}`}
        </p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <div className={styles.skeletonGrid} aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <DocIcon />
          </div>
          <p>{labels.empty}</p>
        </div>
      ) : filteredCount === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <SearchIcon />
          </div>
          <p>{labels.noResults}</p>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {items.map((item, index) => {
              const starLabel = item.starred ? labels.unstarLabel : labels.starLabel;
              const absoluteIndex = rangeStart + index;
              return (
                <article
                  key={item.id}
                  className={`${styles.card} ${item.selected ? styles.cardSelected : ""} ${
                    item.disabled ? styles.cardDisabled : ""
                  } ${item.starred ? styles.cardStarred : ""}`}
                  style={{ animationDelay: `${Math.min(index, 11) * 28}ms` }}
                >
                  <button
                    type="button"
                    className={styles.cardMain}
                    disabled={item.disabled}
                    title={item.disabledReason || item.primary}
                    onClick={() => {
                      if (!item.disabled) onSelect(item.id);
                    }}
                  >
                    <span className={styles.cardIndex}>{absoluteIndex}</span>
                    <span className={styles.cardGlyph} aria-hidden>
                      <DocIcon />
                    </span>
                    <span className={styles.cardBody}>
                      <span className={styles.cardTitle}>{item.primary}</span>
                      {item.secondary ? (
                        <span className={styles.cardSubtitle}>{item.secondary}</span>
                      ) : null}
                      <span className={styles.cardMetaRow}>
                        {item.meta ? <span className={styles.cardMeta}>{item.meta}</span> : null}
                        {labels.openHint && !item.disabled ? (
                          <span className={styles.cardCta}>{labels.openHint}</span>
                        ) : null}
                        {item.disabled && item.disabledReason ? (
                          <span className={styles.cardMeta}>{item.disabledReason}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.starBtn} ${item.starred ? styles.starBtnOn : ""}`}
                    aria-pressed={item.starred}
                    aria-label={starLabel}
                    title={starLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleStar(item.id);
                    }}
                  >
                    <StarIcon filled={item.starred} />
                  </button>
                </article>
              );
            })}
          </div>

          {filteredCount > pageSize ? (
            <div className={styles.pagination}>
              <span className={styles.pageRange}>
                {rangeStart}–{rangeEnd} / {filteredCount}
              </span>
              <div className={styles.pageActions}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={activePage <= 1}
                  onClick={() => onPageChange(Math.max(1, activePage - 1))}
                >
                  {labels.prev}
                </button>
                <span className={styles.pageIndicator}>
                  {activePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={activePage >= totalPages}
                  onClick={() => onPageChange(Math.min(totalPages, activePage + 1))}
                >
                  {labels.next}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
