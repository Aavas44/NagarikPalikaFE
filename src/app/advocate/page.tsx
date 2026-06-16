"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdvocateProfile } from "@/types";
import {
  acceptConsultation,
  declineConsultation,
  getAdvocateProfile,
  getIncomingConsultations,
} from "@/lib/consult";
import type { ConsultationRequest } from "@/types";
import { logout } from "@/lib/auth";
import styles from "@/components/consult/consult.module.css";

type Incoming = ConsultationRequest & { inviteId: string; tier: string };

export default function AdvocateDashboardPage() {
  const [profile, setProfile] = useState<AdvocateProfile | null>(null);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<ConsultationRequest | null>(null);

  async function load() {
    const [prof, reqs] = await Promise.all([
      getAdvocateProfile(),
      getIncomingConsultations(),
    ]);
    setProfile(prof);
    setIncoming(reqs);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAccept(id: string) {
    setActionId(id);
    try {
      const result = await acceptConsultation(id);
      setRevealed(result);
      setIncoming((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setActionId(null);
    }
  }

  async function handleDecline(id: string) {
    setActionId(id);
    try {
      await declineConsultation(id);
      setIncoming((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to decline");
    } finally {
      setActionId(null);
    }
  }

  if (loading) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
        <nav className={styles.portalNav}>
          <Link href="/advocate/profile">Profile</Link>
          <button type="button" className={styles.btnSecondary} onClick={() => logout("/advocate/login")}>
            Sign out
          </button>
        </nav>
      </header>

      <main className={styles.portalMain}>
        <div className={styles.portalCard}>
          <h1>Advocate dashboard</h1>
          {profile && (
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              {profile.advocateName} · {profile.firmName} ·{" "}
              <span className={styles.statusBadge}>{profile.status}</span>
            </p>
          )}
        </div>

        {revealed && (
          <div className={styles.portalCard}>
            <h2>Request accepted — client contact</h2>
            <div className={styles.contactBox}>
              <p><strong>{revealed.name}</strong></p>
              <p>Mobile: {revealed.contactNo}</p>
              {revealed.whatsapp && <p>WhatsApp: {revealed.whatsapp}</p>}
              {revealed.viber && <p>Viber: {revealed.viber}</p>}
              <p style={{ marginTop: 8 }}>{revealed.particulars}</p>
            </div>
          </div>
        )}

        {profile?.status === "pending" && (
          <div className={styles.notice}>
            Your profile is awaiting admin approval. You will receive consultation requests once approved.
          </div>
        )}

        {profile?.status === "rejected" && (
          <div className={styles.error}>
            Your profile was not approved. Please update your details or contact support.
          </div>
        )}

        <div className={styles.portalCard}>
          <h2>Incoming requests ({incoming.length})</h2>
          {profile?.status !== "approved" ? (
            <p style={{ fontSize: 14, color: "#6b7280" }}>
              Requests will appear here after your profile is approved.
            </p>
          ) : incoming.length === 0 ? (
            <p style={{ fontSize: 14, color: "#6b7280" }}>No pending requests.</p>
          ) : (
            incoming.map((r) => (
              <div key={r.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <strong>{r.specialty}</strong> · {r.province}, {r.district}
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      Tier: {r.tier.replace("_", " ")}
                    </p>
                  </div>
                  <span className={styles.statusBadge}>{r.status}</span>
                </div>
                <p style={{ fontSize: 14, margin: "8px 0" }}>{r.particulars}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={actionId === r.id}
                    onClick={() => handleAccept(r.id)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    disabled={actionId === r.id}
                    onClick={() => handleDecline(r.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
