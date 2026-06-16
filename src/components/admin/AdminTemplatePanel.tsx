"use client";

import { useState, type FormEvent } from "react";
import { authedFetch } from "@/lib/auth";
import type { Template, Category, Status } from "@/types";
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

interface AdminTemplatePanelProps {
  initialTemplates: Template[];
}

export function AdminTemplatePanel({ initialTemplates }: AdminTemplatePanelProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [nameEn, setNameEn] = useState("");
  const [nameNe, setNameNe] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descNe, setDescNe] = useState("");
  const [category, setCategory] = useState<Category>("citizenship");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState<"docx" | "pdf">("pdf");
  const [status, setStatus] = useState<Status>("draft");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authedFetch("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: { en: nameEn, ne: nameNe },
          description: { en: descEn, ne: descNe },
          category,
          fileName,
          fileType,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add template");
        return;
      }

      setTemplates((prev) => [data, ...prev]);
      setNameEn("");
      setNameNe("");
      setDescEn("");
      setDescNe("");
      setFileName("");
      setCategory("citizenship");
      setFileType("pdf");
      setStatus("draft");
    } catch {
      setError("Failed to add template");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel} id="templates">
      <div className={styles.panelHeader}>
        <h2>📄 Application templates</h2>
        <span className={styles.countBadge}>{templates.length}</span>
      </div>

      <div className={styles.tblWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name (EN)</th>
              <th>Name (NE)</th>
              <th>Category</th>
              <th>File</th>
              <th>Downloads</th>
              <th>Uploaded</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tmpl) => (
              <tr key={tmpl.id}>
                <td><strong>{tmpl.name.en}</strong></td>
                <td>{tmpl.name.ne}</td>
                <td>
                  <span className={`${styles.catBadge} ${catClass[tmpl.category]}`}>
                    {ADMIN_CATEGORY_LABELS[tmpl.category] ?? tmpl.category}
                  </span>
                </td>
                <td className={styles.fileCell}>
                  {tmpl.fileType === "docx" ? "📝" : "📋"} {tmpl.fileName}
                </td>
                <td>{tmpl.downloads.toLocaleString()}</td>
                <td className={styles.dateCell}>{formatDate(tmpl.uploaded)}</td>
                <td>
                  <span className={styles.statusDot}>
                    <span
                      className={`${styles.dot} ${tmpl.status === "published" ? styles.dotPub : styles.dotDraft}`}
                    />
                    {tmpl.status === "published" ? "Published" : "Draft"}
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
          label="Template name"
          enValue={nameEn}
          neValue={nameNe}
          onEnChange={setNameEn}
          onNeChange={setNameNe}
          enPlaceholder="e.g. Citizenship Application Form"
          nePlaceholder="e.g. नागरिकता आवेदन फारम"
        />
        <BilingualField
          label="Description"
          enValue={descEn}
          neValue={descNe}
          onEnChange={setDescEn}
          onNeChange={setDescNe}
          enPlaceholder="e.g. District Administration Office"
          nePlaceholder="e.g. जिल्ला प्रशासन कार्यालय"
        />
        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ minWidth: 160 }}>
            <label>File name</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. nagarikta-form.pdf"
              required
            />
          </div>
          <div className={styles.formGroup} style={{ maxWidth: 120 }}>
            <label>File type</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value as "docx" | "pdf")}
            >
              <option value="pdf">.pdf</option>
              <option value="docx">.docx</option>
            </select>
          </div>
          <div className={styles.formGroup} style={{ maxWidth: 180 }}>
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
            {loading ? "Saving…" : "✓ Add template"}
          </button>
        </div>
      </form>
    </div>
  );
}
