"use client";

import { useState, type FormEvent } from "react";
import { authedFetch } from "@/lib/auth";
import type { Term, Category, Status } from "@/types";
import { ADMIN_CATEGORY_LABELS } from "@/i18n/messages";
import { BilingualField, ADMIN_CATEGORIES } from "./BilingualField";
import styles from "@/app/admin.module.css";

const catClass: Record<string, string> = {
  citizenship: styles.catLegal,
  "local-government": styles.catFederal,
  revenue: styles.catHousing,
  health: styles.catHealth,
  education: styles.catEducation,
  business: styles.catBusiness,
  legal: styles.catLegal,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AdminTermPanelProps {
  initialTerms: Term[];
}

export function AdminTermPanel({ initialTerms }: AdminTermPanelProps) {
  const [terms, setTerms] = useState(initialTerms);
  const [nameEn, setNameEn] = useState("");
  const [nameNe, setNameNe] = useState("");
  const [defEn, setDefEn] = useState("");
  const [defNe, setDefNe] = useState("");
  const [category, setCategory] = useState<Category>("legal");
  const [status, setStatus] = useState<Status>("draft");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authedFetch("/terms", {
        method: "POST",
        body: JSON.stringify({
          name: { en: nameEn, ne: nameNe },
          definition: { en: defEn, ne: defNe },
          category,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add term");
        return;
      }

      setTerms((prev) => [data, ...prev]);
      setNameEn("");
      setNameNe("");
      setDefEn("");
      setDefNe("");
      setCategory("legal");
      setStatus("draft");
    } catch {
      setError("Failed to add term");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel} id="terminology">
      <div className={styles.panelHeader}>
        <h2>📖 Government terminology</h2>
        <span className={styles.countBadge}>{terms.length}</span>
      </div>

      <div className={styles.tblWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Term (EN)</th>
              <th>Term (NE)</th>
              <th>Category</th>
              <th>Definition preview</th>
              <th>Updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <tr key={term.id}>
                <td><strong>{term.name.en}</strong></td>
                <td>{term.name.ne}</td>
                <td>
                  <span className={`${styles.catBadge} ${catClass[term.category]}`}>
                    {ADMIN_CATEGORY_LABELS[term.category] ?? term.category}
                  </span>
                </td>
                <td className={styles.previewCell}>{term.definition.en}</td>
                <td className={styles.dateCell}>{formatDate(term.lastUpdated)}</td>
                <td>
                  <span className={styles.statusDot}>
                    <span
                      className={`${styles.dot} ${term.status === "published" ? styles.dotPub : styles.dotDraft}`}
                    />
                    {term.status === "published" ? "Published" : "Draft"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <form className={styles.addFormStacked} onSubmit={handleSubmit}>
        <BilingualField
          label="Term name"
          enValue={nameEn}
          neValue={nameNe}
          onEnChange={setNameEn}
          onNeChange={setNameNe}
          enPlaceholder="e.g. Citizenship Certificate (Nagarikta)"
          nePlaceholder="e.g. नागरिकता प्रमाणपत्र"
        />
        <BilingualField
          label="Definition"
          enValue={defEn}
          neValue={defNe}
          onEnChange={setDefEn}
          onNeChange={setDefNe}
          enPlaceholder="Plain-language explanation in English..."
          nePlaceholder="सरल नेपाली व्याख्या..."
          multiline
          rows={3}
        />
        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ maxWidth: 200 }}>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {ADMIN_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup} style={{ maxWidth: 140 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? "Saving…" : "✓ Save term"}
          </button>
        </div>
      </form>
    </div>
  );
}
