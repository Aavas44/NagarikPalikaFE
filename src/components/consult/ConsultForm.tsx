"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CONSULT_FEE_NPR,
  type AdvocateProfile,
  type ProvinceData,
  type Specialty,
} from "@/types";
import {
  createConsultation,
  devMarkPaymentPaid,
  getAdvocates,
  getProvinces,
  getSpecialties,
  initEsewaPayment,
  initKhaltiPayment,
} from "@/lib/consult";
import { fetchCurrentUser, logout } from "@/lib/auth";
import styles from "./consult.module.css";

declare global {
  interface Window {
    KhaltiCheckout?: new (config: Record<string, unknown>) => { show: (opts: { amount: number }) => void };
  }
}

export function ConsultForm() {
  const router = useRouter();
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [advocates, setAdvocates] = useState<AdvocateProfile[]>([]);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [particulars, setParticulars] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [viber, setViber] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "payment">("form");
  const [consultationId, setConsultationId] = useState("");
  const [paymentId, setPaymentId] = useState("");

  useEffect(() => {
    Promise.all([getProvinces(), getSpecialties(), fetchCurrentUser()]).then(
      ([provData, specData, user]) => {
        setProvinces(provData.provinces);
        setSpecialties(specData.specialties);
        if (user?.name) setName(user.name);
        if (user?.phone) setContactNo(user.phone);
      }
    );
  }, []);

  const districts =
    provinces.find((p) => p.name === province)?.districts ?? [];

  useEffect(() => {
    if (!specialty || !province || !district) {
      setAdvocates([]);
      return;
    }
    getAdvocates({ specialty, province, district }).then(setAdvocates);
  }, [specialty, province, district]);

  function toggleAdvocate(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const req = await createConsultation({
        name,
        specialty,
        contactNo,
        province,
        district,
        particulars,
        whatsapp: whatsapp || undefined,
        viber: viber || undefined,
        selectedAdvocateIds: selectedIds,
      });
      setConsultationId(req.id);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  async function payWithEsewa() {
    setError("");
    setLoading(true);
    try {
      const { paymentId: pid, redirectUrl } = await initEsewaPayment(consultationId);
      setPaymentId(pid);
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "eSewa init failed");
      setLoading(false);
    }
  }

  async function payWithKhalti() {
    setError("");
    setLoading(true);
    try {
      const { paymentId: pid, khalti } = await initKhaltiPayment(consultationId);
      setPaymentId(pid);

      if (!window.KhaltiCheckout) {
        const script = document.createElement("script");
        script.src = "https://khalti.com/static/khalti-checkout.js";
        script.onload = () => launchKhalti(khalti, pid);
        document.body.appendChild(script);
      } else {
        launchKhalti(khalti, pid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khalti init failed");
      setLoading(false);
    }
  }

  function launchKhalti(
    khalti: {
      publicKey: string;
      amount: number;
      productIdentity: string;
      productName: string;
      productUrl: string;
    },
    pid: string
  ) {
    if (!window.KhaltiCheckout) return;
    const checkout = new window.KhaltiCheckout({
      publicKey: khalti.publicKey,
      productIdentity: khalti.productIdentity,
      productName: khalti.productName,
      productUrl: khalti.productUrl,
      eventHandler: {
        onSuccess: (payload: { token?: string }) => {
          const token = payload.token ?? "";
          window.location.href = `/consult/payment/khalti/verify?paymentId=${pid}&token=${encodeURIComponent(token)}`;
        },
        onError: () => setError("Khalti payment failed"),
        onClose: () => setLoading(false),
      },
    });
    checkout.show({ amount: khalti.amount });
    setLoading(false);
  }

  async function payDev() {
    setError("");
    setLoading(true);
    try {
      let pid = paymentId;
      if (!pid) {
        const { paymentId: newPid } = await initEsewaPayment(consultationId);
        pid = newPid;
      }
      await devMarkPaymentPaid(pid);
      router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
        <nav className={styles.portalNav}>
          <Link href="/account">My requests</Link>
          <button type="button" className={styles.btnSecondary} onClick={() => logout()}>
            Sign out
          </button>
        </nav>
      </header>

      <main className={styles.portalMain}>
        <div className={styles.portalCard}>
          <h1>Book a legal consultation</h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: "1rem" }}>
            NPR {CONSULT_FEE_NPR.toLocaleString()} · 15 minutes
          </p>

          {error && <div className={styles.error}>{error}</div>}

          {step === "form" ? (
            <form onSubmit={handleSubmit}>
              <div className={styles.notice}>
                Your selected advocate(s) have 18 hours to accept. If none accept, your
                request will be shared with other advocates matching your specialty and
                location.
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="name">Full name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="specialty">Legal specialty</label>
                <select
                  id="specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                >
                  <option value="">Select specialty</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="province">Province</label>
                  <select
                    id="province"
                    value={province}
                    onChange={(e) => {
                      setProvince(e.target.value);
                      setDistrict("");
                    }}
                    required
                  >
                    <option value="">Select province</option>
                    {provinces.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="district">District</label>
                  <select
                    id="district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                    disabled={!province}
                  >
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="contactNo">Contact number</label>
                <input
                  id="contactNo"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="whatsapp">WhatsApp</label>
                  <input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="viber">Viber</label>
                  <input id="viber" value={viber} onChange={(e) => setViber(e.target.value)} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="particulars">Case particulars</label>
                <textarea
                  id="particulars"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  required
                />
              </div>

              {advocates.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Select advocates (optional)</label>
                  <div className={styles.advocateList}>
                    {advocates.map((a) => (
                      <label key={a.id} className={styles.advocateItem}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(a.id)}
                          onChange={() => toggleAdvocate(a.id)}
                        />
                        <span>
                          <strong>{a.advocateName}</strong> — {a.firmName}
                          <br />
                          <span style={{ color: "#6b7280" }}>
                            {a.specialties.join(", ")} · {a.districts.join(", ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? "Submitting…" : "Continue to payment"}
              </button>
            </form>
          ) : (
            <div>
              <p style={{ fontSize: 14, marginBottom: "1rem" }}>
                Pay NPR {CONSULT_FEE_NPR.toLocaleString()} to submit your consultation request.
              </p>
              <div className={styles.paymentBtns}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={payWithEsewa}
                  disabled={loading}
                >
                  Pay with eSewa
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={payWithKhalti}
                  disabled={loading}
                >
                  Pay with Khalti
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={payDev}
                  disabled={loading}
                >
                  Dev: mark paid
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
