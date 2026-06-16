"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdvocateProfile, ProvinceData, Specialty } from "@/types";
import { getAdvocateProfile, getProvinces, getSpecialties, saveAdvocateProfile } from "@/lib/consult";
import { logout } from "@/lib/auth";
import styles from "@/components/consult/consult.module.css";

export default function AdvocateProfilePage() {
  const router = useRouter();
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [firmName, setFirmName] = useState("");
  const [advocateName, setAdvocateName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [viber, setViber] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getProvinces(), getSpecialties(), getAdvocateProfile()]).then(
      ([provData, specData, profile]) => {
        setProvinces(provData.provinces);
        setSpecialties(specData.specialties);
        if (!profile) {
          router.replace("/advocate/signup");
          return;
        }
        setFirmName(profile.firmName);
        setAdvocateName(profile.advocateName);
        setMobile(profile.mobile ?? "");
        setWhatsapp(profile.whatsapp ?? "");
        setViber(profile.viber ?? "");
        setBio(profile.bio ?? "");
        setSelectedSpecialties(profile.specialties);
        setSelectedProvinces(profile.provinces);
        setSelectedDistricts(profile.districts);
        setStatus(profile.status);
      }
    );
  }, [router]);

  const allDistricts = provinces
    .filter((p) => selectedProvinces.includes(p.name))
    .flatMap((p) => p.districts);

  function toggle(arr: string[], val: string, setter: (v: string[]) => void) {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const profile = await saveAdvocateProfile({
        firmName,
        advocateName,
        specialties: selectedSpecialties,
        provinces: selectedProvinces,
        districts: selectedDistricts,
        mobile,
        whatsapp: whatsapp || undefined,
        viber: viber || undefined,
        bio,
      });
      setStatus(profile.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.portal}>
      <header className={styles.portalHeader}>
        <Link href="/">Nagarik Palika</Link>
        <nav className={styles.portalNav}>
          <Link href="/advocate">Dashboard</Link>
          <button type="button" className={styles.btnSecondary} onClick={() => logout("/advocate/login")}>
            Sign out
          </button>
        </nav>
      </header>

      <main className={styles.portalMain}>
        <div className={styles.portalCard}>
          <h1>Practice profile</h1>
          {status && (
            <p style={{ fontSize: 14 }}>
              Status: <span className={styles.statusBadge}>{status}</span>
              {status === "pending" && " — awaiting admin approval"}
            </p>
          )}
          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Firm name</label>
                <input value={firmName} onChange={(e) => setFirmName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label>Your name</label>
                <input value={advocateName} onChange={(e) => setAdvocateName(e.target.value)} required />
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
              <label>Provinces</label>
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
              <label>Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
