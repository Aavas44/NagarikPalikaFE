"use client";

import { useState, type FormEvent } from "react";
import { authedFetch } from "@/lib/auth";
import type { Lawyer } from "@/types";
import { BilingualField } from "./BilingualField";
import styles from "@/app/admin.module.css";

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className={styles.ratingDisplay}>
      {"★".repeat(Math.round(rating))}
      <span style={{ color: "#9ca3af" }}>{"★".repeat(5 - Math.round(rating))}</span>
      <span className={styles.ratingValue}>{rating.toFixed(1)}</span>
    </span>
  );
}

interface AdminLawyerPanelProps {
  initialLawyers: Lawyer[];
}

export function AdminLawyerPanel({ initialLawyers }: AdminLawyerPanelProps) {
  const [lawyers, setLawyers] = useState(initialLawyers);
  const [firmEn, setFirmEn] = useState("");
  const [firmNe, setFirmNe] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameNe, setNameNe] = useState("");
  const [locationEn, setLocationEn] = useState("");
  const [locationNe, setLocationNe] = useState("");
  const [rating, setRating] = useState("4.0");
  const [ratingCount, setRatingCount] = useState("0");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authedFetch("/lawyers", {
        method: "POST",
        body: JSON.stringify({
          firmName: { en: firmEn, ne: firmNe },
          lawyerName: { en: nameEn, ne: nameNe },
          officeLocation: { en: locationEn, ne: locationNe },
          rating: parseFloat(rating),
          ratingCount: parseInt(ratingCount, 10) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add lawyer");
        return;
      }

      setLawyers((prev) => [data, ...prev]);
      setFirmEn("");
      setFirmNe("");
      setNameEn("");
      setNameNe("");
      setLocationEn("");
      setLocationNe("");
      setRating("4.0");
      setRatingCount("0");
    } catch {
      setError("Failed to add lawyer");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lawyer listing?")) return;

    const res = await authedFetch(`/lawyers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLawyers((prev) => prev.filter((l) => l.id !== id));
    }
  }

  return (
    <div className={styles.panel} id="lawyers">
      <div className={styles.panelHeader}>
        <h2>⚖️ Lawyer directory</h2>
        <span className={styles.countBadge}>{lawyers.length} listed</span>
      </div>

      <div className={styles.tblWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Lawyer (EN)</th>
              <th>Lawyer (NE)</th>
              <th>Firm (EN)</th>
              <th>Location</th>
              <th>Rating</th>
              <th>Reviews</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lawyers.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#9ca3af" }}>
                  No lawyers listed yet
                </td>
              </tr>
            )}
            {lawyers.map((lawyer) => (
              <tr key={lawyer.id}>
                <td><strong>{lawyer.lawyerName.en}</strong></td>
                <td>{lawyer.lawyerName.ne}</td>
                <td>{lawyer.firmName.en}</td>
                <td className={styles.previewCell}>{lawyer.officeLocation.en}</td>
                <td><StarDisplay rating={lawyer.rating} /></td>
                <td>{lawyer.ratingCount}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={`${styles.actBtn} ${styles.actBtnDanger}`}
                      title="Delete"
                      onClick={() => handleDelete(lawyer.id)}
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      <form className={styles.addFormStacked} onSubmit={handleSubmit}>
        <BilingualField
          label="Lawyer name"
          enValue={nameEn}
          neValue={nameNe}
          onEnChange={setNameEn}
          onNeChange={setNameNe}
          enPlaceholder="e.g. Adv. Srijana Thapa"
          nePlaceholder="e.g. अधिवक्ता श्रीजना थापा"
        />
        <BilingualField
          label="Firm name"
          enValue={firmEn}
          neValue={firmNe}
          onEnChange={setFirmEn}
          onNeChange={setFirmNe}
          enPlaceholder="e.g. Himal Legal Associates"
          nePlaceholder="e.g. हिमाल लिगल एसोसिएट्स"
        />
        <BilingualField
          label="Office location"
          enValue={locationEn}
          neValue={locationNe}
          onEnChange={setLocationEn}
          onNeChange={setLocationNe}
          enPlaceholder="e.g. Dillibazar, Kathmandu"
          nePlaceholder="e.g. दिल्लीबजार, काठमाडौं"
        />
        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ maxWidth: 100 }}>
            <label>Rating (0–5)</label>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup} style={{ maxWidth: 100 }}>
            <label>Review count</label>
            <input
              type="number"
              min="0"
              value={ratingCount}
              onChange={(e) => setRatingCount(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? "Saving…" : "✓ Add lawyer"}
          </button>
        </div>
      </form>
    </div>
  );
}
