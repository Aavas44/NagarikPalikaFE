"use client";

import { useEffect, useState } from "react";
import type { ConsultationEvent, ConsultationRequest } from "@/types";
import { getAdminConsultations, getConsultationEvents } from "@/lib/consult";
import styles from "@/app/admin.module.css";

export function AdminConsultationPanel() {
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<ConsultationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    getAdminConsultations().then(setConsultations).catch(() => setConsultations([]));
  }, []);

  const filtered = statusFilter
    ? consultations.filter((c) => c.status === statusFilter)
    : consultations;

  async function showTimeline(id: string) {
    setSelectedId(id);
    setLoadingEvents(true);
    try {
      const evts = await getConsultationEvents(id);
      setEvents(evts);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  return (
    <section id="consultations" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Consultations</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All statuses</option>
          <option value="payment_pending">Payment pending</option>
          <option value="pending_selected">Pending selected</option>
          <option value="open_pool">Open pool</option>
          <option value="accepted">Accepted</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className={styles.tblWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Specialty</th>
              <th>Location</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Accepted by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
                <td>{c.name}</td>
                <td>{c.specialty}</td>
                <td>{c.district}, {c.province}</td>
                <td>{c.status.replace(/_/g, " ")}</td>
                <td>{c.paymentStatus ?? "—"}</td>
                <td>{c.acceptedAdvocate?.name ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => showTimeline(c.id)}
                  >
                    Timeline
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className={styles.timelinePanel}>
          <h3>Event timeline — {selectedId.slice(-6)}</h3>
          {loadingEvents ? (
            <p>Loading…</p>
          ) : events.length === 0 ? (
            <p>No events recorded.</p>
          ) : (
            <ul className={styles.timeline}>
              {events.map((e) => (
                <li key={e.id}>
                  <strong>{e.event}</strong> · {e.actorType}
                  {e.createdAt && (
                    <span> — {new Date(e.createdAt).toLocaleString()}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => setSelectedId(null)}>
            Close
          </button>
        </div>
      )}
    </section>
  );
}
