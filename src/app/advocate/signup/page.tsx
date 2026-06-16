"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProvinceData, Specialty } from "@/types";
import { getProvinces, getSpecialties } from "@/lib/consult";
import { advocateRegister, setToken } from "@/lib/auth";
import styles from "@/components/consult/consult.module.css";

export default function AdvocateSignupPage() {
  const router = useRouter();
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firmName, setFirmName] = useState("");
  const [advocateName, setAdvocateName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [viber, setViber] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([getProvinces(), getSpecialties()]).then(([provData, specData]) => {
      setProvinces(provData.provinces);
      setSpecialties(specData.specialties);
    });
  }, []);

  const allDistricts = provinces
    .filter((p) => selectedProvinces.includes(p.name))
    .flatMap((p) => p.districts);

  function toggle(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const { token } = await advocateRegister({
        email,
        password,
        advocateName,
        firmName,
        specialties: selectedSpecialties,
        provinces: selectedProvinces,
        districts: selectedDistricts,
        mobile,
        whatsapp: whatsapp || undefined,
        viber: viber || undefined,
        bio: bio || undefined,
      });
      setToken(token);
      setDone(true);
      setTimeout(() => router.push("/advocate"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={styles.portal}>
        <main className={styles.portalMain}>
          <div className={styles.portalCard}>
            <h1>Registration submitted</h1>
            <p>Your profile is pending admin approval. You will be able to receive requests once approved.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
        <nav className={styles.portalNav}>
          <Link href="/advocate/login">Sign in</Link>
        </nav>
      </header>

      <main className={styles.portalMain}>
        <div className={styles.portalCard}>
          <h1>Advocate registration</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: "1rem" }}>
            Create your practice account. An admin will review and approve your profile before you can receive consultation requests.
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <h2 style={{ fontSize: 15, marginBottom: "0.75rem" }}>Account</h2>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <h2 style={{ fontSize: 15, margin: "1.25rem 0 0.75rem" }}>Practice details</h2>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Your name</label>
                <input value={advocateName} onChange={(e) => setAdvocateName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label>Firm name</label>
                <input value={firmName} onChange={(e) => setFirmName(e.target.value)} required />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Areas of expertise</label>
              <div className={styles.multiSelect}>
                {specialties.map((s) => (
                  <label key={s.id} className={styles.checkboxGroup}>
                    <input
                      type="checkbox"
                      checked={selectedSpecialties.includes(s.id)}
                      onChange={() => toggle(selectedSpecialties, s.id, setSelectedSpecialties)}
                    />
                    {s.labelEn}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Provinces you practice in</label>
              <div className={styles.multiSelect}>
                {provinces.map((p) => (
                  <label key={p.name} className={styles.checkboxGroup}>
                    <input
                      type="checkbox"
                      checked={selectedProvinces.includes(p.name)}
                      onChange={() => toggle(selectedProvinces, p.name, setSelectedProvinces)}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>

            {allDistricts.length > 0 && (
              <div className={styles.formGroup}>
                <label>Districts</label>
                <div className={styles.multiSelect}>
                  {allDistricts.map((d) => (
                    <label key={d} className={styles.checkboxGroup}>
                      <input
                        type="checkbox"
                        checked={selectedDistricts.includes(d)}
                        onChange={() => toggle(selectedDistricts, d, setSelectedDistricts)}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Mobile</label>
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label>WhatsApp</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Viber</label>
              <input value={viber} onChange={(e) => setViber(e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label>Bio (optional)</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Submitting…" : "Register"}
            </button>
          </form>

          <p style={{ fontSize: 13, marginTop: "1rem", color: "#6b7280" }}>
            Already registered? <Link href="/advocate/login">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
