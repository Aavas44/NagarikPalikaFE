"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ConsultationRequest } from "@/types";
import { getMyConsultations } from "@/lib/consult";
import { fetchCurrentUser, logout } from "@/lib/auth";
import styles from "@/components/consult/consult.module.css";

function statusClass(status: string) {
  if (status === "accepted" || status === "completed") return styles.statusAccepted;
  if (status === "payment_pending") return styles.statusPending;
  return "";
}

export default function AccountPage() {
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyConsultations(), fetchCurrentUser()]).then(([reqs, user]) => {
      setRequests(reqs);
      setUserName(user?.name ?? "");
      setLoading(false);
    });
  }, []);

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
        <nav className={styles.portalNav}>
          <Link href="/consult">Book consultation</Link>
          <button type="button" className={styles.btnSecondary} onClick={() => logout()}>
            Sign out
          </button>
        </nav>
      </header>

      <main className={styles.portalMain}>
        <div className={styles.portalCard}>
          <h1>My consultations</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Welcome, {userName}</p>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : requests.length === 0 ? (
          <div className={styles.portalCard}>
            <p>No consultation requests yet.</p>
            <Link href="/consult" className={styles.btnPrimary} style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}>
              Book a consultation
            </Link>
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className={styles.portalCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2>{r.specialty} · {r.district}</h2>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                  </p>
                </div>
                <span className={`${styles.statusBadge} ${statusClass(r.status)}`}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
              <p style={{ fontSize: 14, marginTop: 8 }}>{r.particulars}</p>

              {r.status === "accepted" && r.advocateContact && (
                <div className={styles.contactBox}>
                  <strong>Your matched advocate</strong>
                  {r.advocateContact.advocateName && (
                    <p>{r.advocateContact.advocateName} — {r.advocateContact.firmName}</p>
                  )}
                  {r.advocateContact.mobile && <p>Mobile: {r.advocateContact.mobile}</p>}
                  {r.advocateContact.whatsapp && <p>WhatsApp: {r.advocateContact.whatsapp}</p>}
                  {r.advocateContact.viber && <p>Viber: {r.advocateContact.viber}</p>}
                </div>
              )}

              {r.status === "payment_pending" && (
                <Link href="/consult" style={{ fontSize: 13, color: "#185fa5" }}>
                  Complete payment →
                </Link>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
