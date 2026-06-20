"use client";

import { useEffect, useState } from "react";
import type { Feedback, FeedbackStatus } from "@/types";
import { getAdminFeedback, markFeedbackReviewed } from "@/lib/feedback";
import styles from "@/app/admin.module.css";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function preview(text: string, max = 80) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

interface AdminFeedbackPanelProps {
  initialFeedback?: Feedback[];
}

export function AdminFeedbackPanel({ initialFeedback = [] }: AdminFeedbackPanelProps) {
  const [feedback, setFeedback] = useState<Feedback[]>(initialFeedback);
  const [statusFilter, setStatusFilter] = useState<"" | FeedbackStatus>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialFeedback.length === 0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFeedback.length > 0) return;
    setLoading(true);
    getAdminFeedback()
      .then(setFeedback)
      .catch(() => setFeedback([]))
      .finally(() => setLoading(false));
  }, [initialFeedback.length]);

  const filtered = statusFilter
    ? feedback.filter((item) => item.status === statusFilter)
    : feedback;

  const newCount = feedback.filter((item) => item.status === "new").length;

  async function handleMarkReviewed(id: string) {
    setUpdatingId(id);
    try {
      const updated = await markFeedbackReviewed(id);
      setFeedback((items) => items.map((item) => (item.id === id ? updated : item)));
    } catch {
      // keep list unchanged on error
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section id="feedback" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>User feedback</h2>
        <div className={styles.panelHeaderActions}>
          {newCount > 0 && <span className={styles.countBadge}>{newCount} new</span>}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | FeedbackStatus)}
            className={styles.filterSelect}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className={styles.panelEmpty}>Loading feedback…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.panelEmpty}>No feedback yet.</p>
      ) : (
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>Message</th>
                <th>Locale</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    {item.name || "—"}
                    {item.email ? (
                      <>
                        <br />
                        <a href={`mailto:${item.email}`}>{item.email}</a>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.feedbackPreviewBtn}
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {expandedId === item.id ? item.message : preview(item.message)}
                    </button>
                  </td>
                  <td>{item.locale.toUpperCase()}</td>
                  <td>
                    <span
                      className={
                        item.status === "new" ? styles.statusNew : styles.statusReviewed
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.status === "new" && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={updatingId === item.id}
                        onClick={() => handleMarkReviewed(item.id)}
                      >
                        {updatingId === item.id ? "…" : "Mark reviewed"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
