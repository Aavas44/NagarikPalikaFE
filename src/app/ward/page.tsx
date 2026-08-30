"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth";
import { WardDocumentModal } from "@/components/ward/WardDocumentModal";
import {
  wardFetchMe,
  wardFetchTemplates,
  type WardDocumentTemplate,
  type WardOperatorProfile,
} from "@/lib/ward-access";
import { wardBilingualFieldLabel } from "@/lib/ward-field-labels-ne";
import styles from "@/app/ward/ward.module.css";

const LOCAL_BODY_LABELS: Record<string, string> = {
  nagarpalika: "Nagarpalika",
  gaupalika: "Gaupalika",
  mahanagarpalika: "Mahanagarpalika",
};

export default function WardOperatorPage() {
  const [profile, setProfile] = useState<WardOperatorProfile | null>(null);
  const [templates, setTemplates] = useState<WardDocumentTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<WardDocumentTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const quotaExhausted = useMemo(() => {
    if (!profile || profile.generationUnlimited) return false;
    return (profile.generationRemaining ?? 0) <= 0;
  }, [profile]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, list] = await Promise.all([wardFetchMe(), wardFetchTemplates()]);
      setProfile(me.profile);
      setTemplates(list);
      if (list.length > 0) {
        setSelectedId((current) => current || list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ward portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className={styles.wrap}><p className={styles.muted}>Loading…</p></div>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.brand}>Nagarik Palika</Link>
          <h1>Ward document generator</h1>
          {profile ? (
            <p className={styles.subtitle}>
              {profile.operatorName} · {LOCAL_BODY_LABELS[profile.localBodyType] ?? profile.localBodyType}{" "}
              {profile.localBodyName}, Current ward {profile.wardNo} · {profile.districtName}
            </p>
          ) : null}
          {profile ? (
            <p className={styles.quota}>
              Documents generated:{" "}
              {profile.generationUnlimited
                ? `${profile.generationCount} (unlimited)`
                : `${profile.generationCount} / ${profile.generationLimit ?? 0}`}
              {!profile.generationUnlimited && (profile.generationRemaining ?? 0) <= 0
                ? " · Limit reached"
                : null}
            </p>
          ) : null}
        </div>
        <button type="button" className={styles.logoutBtn} onClick={() => logout("/sajilokanun/login")}>
          Sign out
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {templates.length === 0 ? (
        <div className={styles.empty}>
          <p>No published templates yet. Ask your superadmin to publish ward templates.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          <aside className={styles.sidebar}>
            <h2>Templates</h2>
            <ul className={styles.templateList}>
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={
                      template.id === selectedId
                        ? `${styles.templateBtn} ${styles.templateBtnActive}`
                        : styles.templateBtn
                    }
                    onClick={() => setSelectedId(template.id)}
                  >
                    <strong>{template.name.en}</strong>
                    {template.name.ne ? <span>{template.name.ne}</span> : null}
                    <em>{template.fileType.toUpperCase()}</em>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className={styles.panel}>
            {selected ? (
              <>
                <h2>{selected.name.en}</h2>
                {selected.description.en ? (
                  <p className={styles.muted}>{selected.description.en}</p>
                ) : null}
                <p className={styles.hint}>
                  Click generate to fill document details. Application date is today&apos;s
                  Nepali (Bikram Sambat) date. Applicant district, local level, and ward no.
                  stay the same as this ward office.
                </p>
                {selected.variables.length > 0 ? (
                  <div className={styles.variableList}>
                    <h3>यस टेम्प्लेटमा सोधिने फिल्डहरू</h3>
                    <ul>
                      {selected.variables.map((variable) => (
                        <li key={variable.key}>
                          {wardBilingualFieldLabel(variable.key, variable.label.ne, variable.label.en)}
                          {variable.required ? " *" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className={styles.muted}>
                    Placeholders in the DOCX (e.g. name, citizenship no., contact) will be
                    detected automatically when you generate.
                  </p>
                )}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={selected.fileType !== "docx" || quotaExhausted}
                  onClick={() => setActiveTemplate(selected)}
                >
                  {quotaExhausted
                    ? "Generation limit reached"
                    : selected.fileType === "docx"
                      ? "Generate document"
                      : "DOCX fill only (PDF coming soon)"}
                </button>
              </>
            ) : null}
          </section>
        </div>
      )}

      {activeTemplate && profile ? (
        <WardDocumentModal
          template={activeTemplate}
          profile={profile}
          quotaExhausted={quotaExhausted}
          onClose={() => setActiveTemplate(null)}
          onDownloaded={setProfile}
        />
      ) : null}
    </div>
  );
}
