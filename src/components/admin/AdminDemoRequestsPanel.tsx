"use client";

import { useEffect, useState } from "react";
import type { DemoRequestStatus } from "@/types";
import { getAdminDemoRequests, updateDemoRequestStatus } from "@/lib/demo-request";
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

export function AdminDemoRequestsPanel() {
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof getAdminDemoRequests>>>([]);
  const [statusFilter, setStatusFilter] = useState<"" | DemoRequestStatus>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminDemoRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter
    ? requests.filter((item) => item.status === statusFilter)
    : requests;

  const newCount = requests.filter((item) => item.status === "new").length;

  async function handleStatusChange(id: string, status: DemoRequestStatus) {
    setUpdatingId(id);
    try {
      const updated = await updateDemoRequestStatus(id, status);
      setRequests((items) => items.map((item) => (item.id === id ? updated : item)));
    } catch {
      // keep list unchanged on error
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section id="demo-requests" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Sajilo Kanun demo requests</h2>
        <div className={styles.panelHeaderActions}>
          {newCount > 0 && <span className={styles.countBadge}>{newCount} new</span>}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | DemoRequestStatus)}
            className={styles.filterSelect}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className={styles.panelEmpty}>Loading demo requests…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.panelEmpty}>No demo requests yet.</p>
      ) : (
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Contact</th>
                <th>Profession</th>
                <th>Queries</th>
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
                    {item.name}
                    <br />
                    <a href={`mailto:${item.email}`}>{item.email}</a>
                    <br />
                    {item.contactNo}
                  </td>
                  <td>{item.profession}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.feedbackPreviewBtn}
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {expandedId === item.id ? item.queries : preview(item.queries)}
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
                      <div className={styles.actionBtnGroup}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={updatingId === item.id}
                          onClick={() => handleStatusChange(item.id, "reviewed")}
                        >
                          Reviewed
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={updatingId === item.id}
                          onClick={() => handleStatusChange(item.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          disabled={updatingId === item.id}
                          onClick={() => handleStatusChange(item.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
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
