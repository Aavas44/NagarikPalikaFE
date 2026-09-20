"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { docxToEditableHtml } from "@/lib/sajilokanun/docx-to-preview-html";
import {
  adminFetchSkOfficialFormFile,
  adminFetchSkReviewCatalog,
  adminFetchSkTemplateFile,
  adminSaveSkTemplateContent,
  adminUpdateSkTemplate,
  type SajiloKanunDocumentTemplate,
  type SkReviewCatalogItem,
  type SkReviewCourtType,
} from "@/lib/sajilo-kanun-templates-admin";
import { COURT_TYPE_META } from "@/lib/sajilokanun/court-type";
import styles from "@/app/admin.module.css";

const COURT_TABS: SkReviewCourtType[] = ["supreme", "high", "district"];

type AdminSajiloKanunTemplateReviewProps = {
  onClose: () => void;
  onSaved: (template: SajiloKanunDocumentTemplate) => void;
};

function insertTextAtSelection(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function AdminSajiloKanunTemplateReview({
  onClose,
  onSaved,
}: AdminSajiloKanunTemplateReviewProps) {
  const [courtType, setCourtType] = useState<SkReviewCourtType>("supreme");
  const [items, setItems] = useState<SkReviewCatalogItem[]>([]);
  const [sourceUrl, setSourceUrl] = useState(
    "https://supremecourt.gov.np/web/suptemp"
  );
  const [matchedCount, setMatchedCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  const [officialError, setOfficialError] = useState("");
  const [officialLoading, setOfficialLoading] = useState(false);
  const officialHostRef = useRef<HTMLDivElement | null>(null);
  const officialStyleRef = useRef<HTMLDivElement | null>(null);
  const officialRenderGen = useRef(0);

  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [oursLoaded, setOursLoaded] = useState(false);
  const [oursError, setOursError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [customVariable, setCustomVariable] = useState("");
  const editorRef = useRef<HTMLElement | null>(null);

  const current = items[index] ?? null;
  const dirty = draft !== baseline;
  const template = current?.template ?? null;

  const loadCatalog = useCallback(async (nextCourt: SkReviewCourtType) => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const data = await adminFetchSkReviewCatalog(nextCourt);
      setItems(data.items);
      setSourceUrl(data.sourceUrl);
      setMatchedCount(data.matched);
      setIndex(0);
    } catch (err) {
      setItems([]);
      setCatalogError(
        err instanceof Error ? err.message : "Failed to load review catalog"
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog(courtType);
  }, [courtType, loadCatalog]);

  useEffect(() => {
    if (!current) {
      setOfficialError("");
      setDraft("");
      setBaseline("");
      setOursLoaded(true);
      setOursError("");
      if (officialHostRef.current) officialHostRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;
    const renderId = ++officialRenderGen.current;
    setOfficialLoading(true);
    setOfficialError("");
    setOursLoaded(false);
    setOursError("");
    setSaveError("");
    setDraft("");
    setBaseline("");
    if (officialHostRef.current) officialHostRef.current.innerHTML = "";
    if (officialStyleRef.current) officialStyleRef.current.innerHTML = "";

    void (async () => {
      try {
        const blob = await adminFetchSkOfficialFormFile(
          current.courtType,
          current.formNumber
        );
        if (cancelled || renderId !== officialRenderGen.current) return;
        const host = officialHostRef.current;
        const styleHost = officialStyleRef.current;
        if (!host) return;
        host.innerHTML = "";
        await renderAsync(blob, host, styleHost ?? undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          useBase64URL: true,
          experimental: true,
        });
        if (cancelled || renderId !== officialRenderGen.current) {
          host.innerHTML = "";
        }
      } catch (err) {
        if (!cancelled && renderId === officialRenderGen.current) {
          setOfficialError(
            err instanceof Error
              ? err.message
              : "Failed to load official form"
          );
        }
      } finally {
        if (!cancelled && renderId === officialRenderGen.current) {
          setOfficialLoading(false);
        }
      }
    })();

    void (async () => {
      if (!current.template) {
        if (!cancelled) {
          setOursError("No matching template in our database for this form.");
          setOursLoaded(true);
        }
        return;
      }
      try {
        const blob = await adminFetchSkTemplateFile(current.template.id);
        const html = await docxToEditableHtml(blob);
        if (!cancelled) {
          setDraft(html);
          setBaseline(html);
          setOursLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setOursError(
            err instanceof Error
              ? err.message
              : "Failed to load our template document"
          );
          setOursLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !oursLoaded || !template) return;
    el.innerHTML = draft;
    // Rehydrate only when the compared form changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oursLoaded, template?.id, current?.formNumber]);

  function confirmLeaveIfDirty(): boolean {
    if (!dirty) return true;
    return window.confirm(
      "You have unsaved changes to our template. Leave without saving?"
    );
  }

  function goToIndex(next: number) {
    if (next === index) return;
    if (!confirmLeaveIfDirty()) return;
    setIndex(next);
  }

  function changeCourt(next: SkReviewCourtType) {
    if (next === courtType) return;
    if (!confirmLeaveIfDirty()) return;
    setCourtType(next);
  }

  function syncDraftFromEditor() {
    if (editorRef.current) setDraft(editorRef.current.innerHTML);
  }

  function handleInsertVariable(key: string) {
    if (!template) return;
    const token = `{${key}}`;
    if (!insertTextAtSelection(token)) {
      setDraft((currentDraft) => `${currentDraft}${token}`);
      if (editorRef.current) {
        editorRef.current.innerHTML = `${editorRef.current.innerHTML}${token}`;
      }
    } else {
      syncDraftFromEditor();
    }
  }

  function rememberUpdated(updated: SajiloKanunDocumentTemplate) {
    setItems((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, template: updated } : row
      )
    );
    onSaved(updated);
  }

  async function handleSave() {
    if (!template || saving || !dirty) return;
    setSaving(true);
    setSaveError("");
    try {
      const content = editorRef.current?.innerHTML ?? draft;
      const updated = await adminSaveSkTemplateContent(template.id, content, {
        publish: true,
      });
      setDraft(content);
      setBaseline(content);
      rememberUpdated(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!template || saving || template.status === "published") return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await adminUpdateSkTemplate(template.id, {
        status: "published",
      });
      rememberUpdated(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (!confirmLeaveIfDirty()) return;
    onClose();
  }

  const insertKeys = useMemo(() => {
    if (!template) return [];
    return Array.from(new Set(template.variables.map((v) => v.key))).sort();
  }, [template]);

  const courtLabel = COURT_TYPE_META[courtType].labelNe;

  return (
    <div className={styles.wardTemplateEditorBackdrop} role="presentation">
      <div
        className={styles.skTemplateReviewModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sk-template-review-title"
      >
        <header className={styles.skTemplateReviewHeader}>
          <div className={styles.skTemplateReviewHeaderMain}>
            <h3 id="sk-template-review-title">Review Templates</h3>
            <p className={styles.skEditUserHint}>
              Serial order from{" "}
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                supremecourt.gov.np/web/suptemp
              </a>
              {" · "}
              {matchedCount}/{items.length} matched in DB · left = official Word
              layout, right = ours (what firms generate). Firm portal only shows{" "}
              <strong>published</strong> templates for the case's court type —
              Save publishes the right-hand file.
            </p>
            <div className={styles.skTemplateReviewTabs}>
              {COURT_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.skTemplatePageBtn} ${
                    tab === courtType ? styles.skTemplatePageBtnActive : ""
                  }`}
                  onClick={() => changeCourt(tab)}
                >
                  {COURT_TYPE_META[tab].labelNe}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.wardTemplateEditorActions}>
            <button
              type="button"
              className={styles.skSmallBtn}
              onClick={handleClose}
            >
              Close
            </button>
            {template && template.status !== "published" && !dirty ? (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => void handlePublish()}
                disabled={saving || !oursLoaded}
              >
                {saving ? "Publishing…" : "Publish to firm portal"}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleSave()}
              disabled={!template || !dirty || saving || !oursLoaded}
            >
              {saving ? "Saving…" : "Save & publish"}
            </button>
          </div>
        </header>

        {catalogLoading ? (
          <p className={styles.panelDesc}>Loading catalog…</p>
        ) : catalogError ? (
          <p className={styles.formError}>{catalogError}</p>
        ) : !current ? (
          <p className={styles.panelDesc}>No official forms for {courtLabel}.</p>
        ) : (
          <>
            <div className={styles.skTemplateReviewNav}>
              <button
                type="button"
                className={styles.skSmallBtn}
                disabled={index <= 0}
                onClick={() => goToIndex(index - 1)}
              >
                ← Previous
              </button>
              <label className={styles.skTemplateReviewJump}>
                Form
                <select
                  value={index}
                  onChange={(e) => goToIndex(Number(e.target.value))}
                >
                  {items.map((item, i) => (
                    <option key={`${item.courtType}-${item.formNumber}`} value={i}>
                      {item.formNumber}. {item.title}
                      {item.template ? "" : " (missing)"}
                    </option>
                  ))}
                </select>
              </label>
              <span className={styles.skTemplateReviewMeta}>
                {index + 1} / {items.length} · {courtLabel} फाराम न{" "}
                {current.formNumber}
                {template ? ` · DB: ${template.status}` : " · not in DB"}
              </span>
              <a
                className={styles.skSmallBtn}
                href={current.officialUrl}
                target="_blank"
                rel="noreferrer"
              >
                Official DOCX
              </a>
              <button
                type="button"
                className={styles.skSmallBtn}
                disabled={index >= items.length - 1}
                onClick={() => goToIndex(index + 1)}
              >
                Next →
              </button>
            </div>

            {saveError ? <p className={styles.formError}>{saveError}</p> : null}

            <div className={styles.skTemplateReviewSplit}>
              <section className={styles.skTemplateReviewPane}>
                <header className={styles.skTemplateReviewPaneHeader}>
                  <strong>Official (SC)</strong>
                  <span>{current.title}</span>
                </header>
                <div className={styles.skTemplateReviewPaneBody}>
                  <div
                    ref={officialStyleRef}
                    className={styles.skTemplateReviewOfficialStyles}
                    aria-hidden
                  />
                  {officialLoading ? (
                    <p className={styles.panelDesc}>Loading official form…</p>
                  ) : null}
                  {officialError ? (
                    <p className={styles.formError}>{officialError}</p>
                  ) : null}
                  <div
                    ref={officialHostRef}
                    className={styles.skTemplateReviewOfficial}
                  />
                </div>
              </section>

              <section className={styles.skTemplateReviewPane}>
                <header className={styles.skTemplateReviewPaneHeader}>
                  <strong>Our template</strong>
                  <span>
                    {template
                      ? template.name.ne || template.name.en
                      : current.documentKind}
                  </span>
                </header>
                {!template ? (
                  <div className={styles.skTemplateReviewPaneBody}>
                    <p className={styles.formError}>{oursError}</p>
                  </div>
                ) : !oursLoaded ? (
                  <div className={styles.skTemplateReviewPaneBody}>
                    <p className={styles.panelDesc}>Loading our template…</p>
                  </div>
                ) : oursError ? (
                  <div className={styles.skTemplateReviewPaneBody}>
                    <p className={styles.formError}>{oursError}</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.wardTemplateEditorToolbar}>
                      <span className={styles.wardTemplateEditorToolbarLabel}>
                        Insert variable:
                      </span>
                      <div className={styles.wardTemplateEditorChips}>
                        {insertKeys.length === 0 ? (
                          <span className={styles.panelDesc}>
                            Type {"{key}"} or add below.
                          </span>
                        ) : (
                          insertKeys.map((key) => (
                            <button
                              key={key}
                              type="button"
                              className={styles.wardTemplateEditorChip}
                              onClick={() => handleInsertVariable(key)}
                            >
                              {`{${key}}`}
                            </button>
                          ))
                        )}
                      </div>
                      <div className={styles.wardTemplateEditorCustomVar}>
                        <input
                          value={customVariable}
                          onChange={(e) => setCustomVariable(e.target.value)}
                          placeholder="custom_key"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const key = customVariable
                                .trim()
                                .replace(/[{}]/g, "");
                              if (!key) return;
                              handleInsertVariable(key);
                              setCustomVariable("");
                            }
                          }}
                        />
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          onClick={() => {
                            const key = customVariable
                              .trim()
                              .replace(/[{}]/g, "");
                            if (!key) return;
                            handleInsertVariable(key);
                            setCustomVariable("");
                          }}
                        >
                          Insert
                        </button>
                      </div>
                    </div>
                    <div
                      ref={(node) => {
                        editorRef.current = node;
                      }}
                      className={`${styles.wardTemplateEditorBody} ${styles.skTemplateReviewEditor}`}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncDraftFromEditor}
                      onBlur={syncDraftFromEditor}
                    />
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
