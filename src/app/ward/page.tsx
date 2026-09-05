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
import { TemplateCatalog } from "@/components/TemplateCatalog";
import styles from "@/app/ward/ward.module.css";

const LOCAL_BODY_LABELS: Record<string, string> = {
  nagarpalika: "Nagarpalika",
  gaupalika: "Gaupalika",
  mahanagarpalika: "Mahanagarpalika",
};

const TEMPLATE_PAGE_SIZE = 12;

export default function WardOperatorPage() {
  const [profile, setProfile] = useState<WardOperatorProfile | null>(null);
  const [templates, setTemplates] = useState<WardDocumentTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<WardDocumentTemplate | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const starLock = useRef(new Set<string>());

  const quotaExhausted = useMemo(() => {
    if (!profile || profile.generationUnlimited) return false;
    return (profile.generationRemaining ?? 0) <= 0;
  }, [profile]);

  const starredIds = profile?.starredTemplateIds ?? [];

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim();
    let matched = !q
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
    if (showStarredOnly) {
      matched = matched.filter((template) => starredIds.includes(template.id));
    }
    return sortStarredFirst(matched, starredIds);
  }, [templates, templateSearch, showStarredOnly, starredIds]);

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
    return (
      <div className={styles.wrap}>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.brand}>
            Nagarik Palika
          </Link>
          <h1>Ward document generator</h1>
          {profile ? (
            <p className={styles.subtitle}>
              {profile.operatorName} ·{" "}
              {LOCAL_BODY_LABELS[profile.localBodyType] ?? profile.localBodyType}{" "}
              {profile.localBodyName}, Current ward {profile.wardNo} ·{" "}
              {profile.districtName}
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
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={() => logout("/sajilokanun/login")}
        >
          Sign out
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={`${styles.panel} ${styles.catalogPanel}`}>
        <div className={styles.catalogHeader}>
          <div>
            <h2 className={styles.panelTitle}>Document templates</h2>
            <p className={styles.hint}>
              टेम्प्लेट छान्नुहोस् — तारा थिचेर बुकमार्क गर्नुहोस्, फिल्ड भर्नुहोस्,
              पूर्वावलोकनमा सम्पादन गर्नुहोस्, त्यसपछि डाउनलोड गर्नुहोस्।
            </p>
          </div>
        </div>

        <TemplateCatalog
          items={pagedTemplates.map((template) => {
            const primary = template.name.ne || template.name.en;
            const secondary =
              template.name.en && template.name.en !== primary
                ? template.name.en
                : undefined;
            const disabled = template.fileType !== "docx";
            return {
              id: template.id,
              primary,
              secondary,
              meta: template.fileType.toUpperCase(),
              starred: starredIds.includes(template.id),
              selected: activeTemplate?.id === template.id,
              disabled,
              disabledReason: disabled ? "DOCX only (PDF soon)" : undefined,
            };
          })}
          filteredCount={filteredTemplates.length}
          totalCount={templates.length}
          search={templateSearch}
          onSearchChange={(value) => {
            setTemplateSearch(value);
            setTemplatePage(1);
          }}
          page={activeTemplatePage}
          pageSize={TEMPLATE_PAGE_SIZE}
          onPageChange={setTemplatePage}
          showStarredOnly={showStarredOnly}
          onShowStarredOnlyChange={(value) => {
            setShowStarredOnly(value);
            setTemplatePage(1);
          }}
          starredCount={starredIds.length}
          labels={{
            searchLabel: "Search templates",
            searchPlaceholder: "Search by Nepali or English name…",
            all: "All",
            starred: "Starred",
            empty: "No published templates yet. Ask your superadmin to publish ward templates.",
            noResults: "No templates match that search.",
            starLabel: "बुकमार्क गर्नुहोस्",
            unstarLabel: "बुकमार्क हटाउनुहोस्",
            prev: "Prev",
            next: "Next",
            openHint: "Open →",
          }}
          onToggleStar={(id) => void toggleStar(id)}
          onSelect={(id) => {
            const template = templates.find((item) => item.id === id);
            if (!template || template.fileType !== "docx") return;
            setError("");
            setActiveTemplate(template);
          }}
        />
      </section>

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
