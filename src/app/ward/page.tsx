"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth";
import { WardDocumentModal } from "@/components/ward/WardDocumentModal";
import {
  wardFetchMe,
  wardFetchTemplates,
  wardSetStarredTemplate,
  type WardDocumentTemplate,
  type WardOperatorProfile,
} from "@/lib/ward-access";
import { matchesNepaliRomanSearch } from "@/lib/sajilokanun/nepali-roman-search";
import { sortStarredFirst, toggleStarredId } from "@/lib/starred-templates";
import { TemplateStarChip } from "@/components/TemplateStarChip";
import styles from "@/app/ward/ward.module.css";

const LOCAL_BODY_LABELS: Record<string, string> = {
  nagarpalika: "Nagarpalika",
  gaupalika: "Gaupalika",
  mahanagarpalika: "Mahanagarpalika",
};

const TEMPLATE_PAGE_SIZE = 20;

export default function WardOperatorPage() {
  const [profile, setProfile] = useState<WardOperatorProfile | null>(null);
  const [templates, setTemplates] = useState<WardDocumentTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<WardDocumentTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const starLock = useRef(new Set<string>());

  const quotaExhausted = useMemo(() => {
    if (!profile || profile.generationUnlimited) return false;
    return (profile.generationRemaining ?? 0) <= 0;
  }, [profile]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim();
    const matched = !q
      ? templates
      : templates.filter((template) =>
          matchesNepaliRomanSearch(q, [
            template.name.ne,
            template.name.en,
            template.slug,
            template.description?.ne,
            template.description?.en,
          ])
        );
    return sortStarredFirst(matched, profile?.starredTemplateIds);
  }, [templates, templateSearch, profile?.starredTemplateIds]);

  const templateTotalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / TEMPLATE_PAGE_SIZE) || 1
  );
  const activeTemplatePage = Math.min(templatePage, templateTotalPages);
  const pagedTemplates = filteredTemplates.slice(
    (activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE,
    activeTemplatePage * TEMPLATE_PAGE_SIZE
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, list] = await Promise.all([wardFetchMe(), wardFetchTemplates()]);
      setProfile(me.profile);
      setTemplates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ward portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStar(templateId: string) {
    if (!profile || starLock.current.has(templateId)) return;
    const starred = !(profile.starredTemplateIds ?? []).includes(templateId);
    const previous = profile.starredTemplateIds ?? [];
    starLock.current.add(templateId);
    setProfile({
      ...profile,
      starredTemplateIds: toggleStarredId(previous, templateId),
    });
    if (starred) setTemplatePage(1);
    try {
      const starredTemplateIds = await wardSetStarredTemplate(templateId, starred);
      setProfile((current) =>
        current ? { ...current, starredTemplateIds } : current
      );
    } catch (err) {
      setProfile((current) =>
        current ? { ...current, starredTemplateIds: previous } : current
      );
      setError(err instanceof Error ? err.message : "Failed to update bookmark");
    } finally {
      starLock.current.delete(templateId);
    }
  }

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
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Document generator</h2>
          <p className={styles.hint}>
            टेम्प्लेट छान्नुहोस् — तारा थिचेर बुकमार्क गर्नुहोस्, फिल्ड भर्नुहोस्, पूर्वावलोकनमा सम्पादन गर्नुहोस्, त्यसपछि डाउनलोड गर्नुहोस्।
            वडा कार्यालयको ठेगाना र आजको नेपाली मिति स्वतः भरिन्छ।
          </p>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            {filteredTemplates.length} template{filteredTemplates.length === 1 ? "" : "s"}
            {templateSearch.trim() ? ` matching “${templateSearch.trim()}”` : ""}
          </p>

          <div className={styles.searchField}>
            <label htmlFor="ward-template-search">Search templates</label>
            <input
              id="ward-template-search"
              className={styles.searchInput}
              value={templateSearch}
              onChange={(e) => {
                setTemplateSearch(e.target.value);
                setTemplatePage(1);
              }}
              placeholder="Search templates"
            />
          </div>

          {filteredTemplates.length === 0 ? (
            <p className={styles.muted}>No templates match that search.</p>
          ) : (
            <>
              <div className={styles.presets}>
                {pagedTemplates.map((template) => {
                  const primary = template.name.ne || template.name.en;
                  const secondary =
                    template.name.en && template.name.en !== primary
                      ? template.name.en
                      : "";
                  const disabled = template.fileType !== "docx";
                  const starred = (profile?.starredTemplateIds ?? []).includes(
                    template.id
                  );
                  return (
                    <TemplateStarChip
                      key={template.id}
                      starred={starred}
                      selected={activeTemplate?.id === template.id}
                      disabled={disabled}
                      primary={primary}
                      secondary={secondary || undefined}
                      title={
                        disabled
                          ? "DOCX fill only (PDF coming soon)"
                          : primary
                      }
                      starLabel="बुकमार्क गर्नुहोस्"
                      unstarLabel="बुकमार्क हटाउनुहोस्"
                      onToggleStar={() => void toggleStar(template.id)}
                      onSelect={() => {
                        if (disabled) return;
                        setError("");
                        setActiveTemplate(template);
                      }}
                    />
                  );
                })}
              </div>
              {filteredTemplates.length > TEMPLATE_PAGE_SIZE ? (
                <div className={styles.pagination}>
                  <span className={styles.muted}>
                    {`${(activeTemplatePage - 1) * TEMPLATE_PAGE_SIZE + 1}–${Math.min(
                      activeTemplatePage * TEMPLATE_PAGE_SIZE,
                      filteredTemplates.length
                    )} / ${filteredTemplates.length}`}
                  </span>
                  <div className={styles.paginationActions}>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={activeTemplatePage <= 1}
                      onClick={() =>
                        setTemplatePage((page) => Math.max(1, page - 1))
                      }
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      disabled={activeTemplatePage >= templateTotalPages}
                      onClick={() =>
                        setTemplatePage((page) =>
                          Math.min(templateTotalPages, page + 1)
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
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
