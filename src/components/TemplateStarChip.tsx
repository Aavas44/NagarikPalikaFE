"use client";

import styles from "./TemplateStarChip.module.css";

type TemplateStarChipProps = {
  starred: boolean;
  disabled?: boolean;
  selected?: boolean;
  title?: string;
  starLabel: string;
  unstarLabel: string;
  primary: string;
  secondary?: string;
  onToggleStar: () => void;
  onSelect: () => void;
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
    >
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

export function TemplateStarChip({
  starred,
  disabled = false,
  selected = false,
  title,
  starLabel,
  unstarLabel,
  primary,
  secondary,
  onToggleStar,
  onSelect,
}: TemplateStarChipProps) {
  const label = starred ? unstarLabel : starLabel;
  return (
    <div
      className={`${styles.wrap} ${selected ? styles.wrapSelected : ""} ${
        disabled ? styles.wrapDisabled : ""
      }`}
    >
      <button
        type="button"
        className={`${styles.star} ${starred ? styles.starOn : ""}`}
        aria-pressed={starred}
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          onToggleStar();
        }}
      >
        <StarIcon filled={starred} />
      </button>
      <button
        type="button"
        className={styles.chip}
        disabled={disabled}
        aria-pressed={selected}
        title={title}
        onClick={onSelect}
      >
        <span className={styles.primary}>{primary}</span>
        {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
      </button>
    </div>
  );
}
