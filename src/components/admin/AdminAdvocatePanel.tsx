"use client";

import { useEffect, useState } from "react";
import type { AdvocateProfile } from "@/types";
import { approveAdvocate, getPendingAdvocates, rejectAdvocate } from "@/lib/consult";
import styles from "@/app/admin.module.css";

export function AdminAdvocatePanel() {
  const [advocates, setAdvocates] = useState<AdvocateProfile[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    getPendingAdvocates().then(setAdvocates).catch(() => setAdvocates([]));
  }, []);

  async function handleApprove(id: string) {
    setLoadingId(id);
    try {
      const updated = await approveAdvocate(id);
      setAdvocates((prev) => prev.filter((a) => a.id !== id));
      void updated;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt("Rejection reason (optional):");
    setLoadingId(id);
    try {
      await rejectAdvocate(id, reason ?? undefined);
      setAdvocates((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section id="advocate-approvals" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Advocate approvals</h2>
        <span className={styles.countBadge}>{advocates.length} pending</span>
      </div>

      {advocates.length === 0 ? (
        <p className={styles.emptyState}>No pending advocate profiles.</p>
      ) : (
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Firm</th>
                <th>Specialties</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {advocates.map((a) => (
                <tr key={a.id}>
                  <td>{a.advocateName}</td>
                  <td>{a.firmName}</td>
                  <td>{a.specialties.join(", ")}</td>
                  <td>{a.districts.slice(0, 3).join(", ")}</td>
                  <td>{a.mobile}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={loadingId === a.id}
                      onClick={() => handleApprove(a.id)}
                    >
                      Approve
                    </button>{" "}
                    <button
                      type="button"
                      className={styles.btnDanger}
                      disabled={loadingId === a.id}
                      onClick={() => handleReject(a.id)}
                    >
                      Reject
                    </button>
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
