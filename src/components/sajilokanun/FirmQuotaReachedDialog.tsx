"use client";

import styles from "@/components/sajilokanun/FirmQuotaReachedDialog.module.css";

export type FirmQuotaKind = "cases" | "documents" | "ai";

export type FirmQuotaAlertCopy = {
  titleEn: string;
  titleNe: string;
  caseLimitEn: string;
  caseLimitNe: string;
  documentsLimitEn: string;
  documentsLimitNe: string;
  aiLimitEn: string;
  aiLimitNe: string;
  contactEn: string;
  contactNe: string;
  closeEn: string;
  closeNe: string;
};

type Props = {
  kind: FirmQuotaKind;
  used: number;
  limit: number;
  labels: FirmQuotaAlertCopy;
  onClose: () => void;
};

function fill(template: string, used: number, limit: number) {
  return template
    .replace(/\{used\}/g, String(used))
    .replace(/\{limit\}/g, String(limit));
}

export function FirmQuotaReachedDialog({
  kind,
  used,
  limit,
  labels,
  onClose,
}: Props) {
  const bodyEn =
    kind === "cases"
      ? labels.caseLimitEn
      : kind === "documents"
        ? labels.documentsLimitEn
        : labels.aiLimitEn;
  const bodyNe =
    kind === "cases"
      ? labels.caseLimitNe
      : kind === "documents"
        ? labels.documentsLimitNe
        : labels.aiLimitNe;

  return (
    <div className={styles.overlay}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label={labels.closeEn}
        onClick={onClose}
      />
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="firm-quota-title"
      >
        <h2 id="firm-quota-title" className={styles.title}>
          <span>{labels.titleEn}</span>
          <span className={styles.titleNe}>{labels.titleNe}</span>
        </h2>

        <div className={styles.bodyBlock}>
          <p className={styles.bodyEn}>{fill(bodyEn, used, limit)}</p>
          <p className={styles.bodyNe}>{fill(bodyNe, used, limit)}</p>
        </div>

        <div className={styles.contactBlock}>
          <p className={styles.bodyEn}>{labels.contactEn}</p>
          <p className={styles.bodyNe}>{labels.contactNe}</p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {labels.closeEn} / {labels.closeNe}
          </button>
        </div>
      </div>
    </div>
  );
}
