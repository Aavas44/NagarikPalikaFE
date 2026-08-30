"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  adminFetchSkTemplateFile,
  adminSaveSkTemplateContent,
  type SajiloKanunDocumentTemplate,
} from "@/lib/sajilo-kanun-templates-admin";
import { COURT_TYPE_META } from "@/lib/sajilokanun/court-type";
import styles from "@/app/admin.module.css";

type AdminSajiloKanunTemplateEditorProps = {
  template: SajiloKanunDocumentTemplate;
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

export function AdminSajiloKanunTemplateEditor({
  template,
  onClose,
  onSaved,
}: AdminSajiloKanunTemplateEditorProps) {
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [customVariable, setCustomVariable] = useState("");
  const editorRef = useRef<HTMLElement | null>(null);

  const dirty = draft !== baseline;
  const courtLabel = COURT_TYPE_META[template.courtType].labelNe;

  const loadContent = useCallback(async () => {
    setLoaded(false);
    setLoadError("");
    try {
      const blob = await adminFetchSkTemplateFile(template.id);
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const value = result.value || "<p></p>";
      setDraft(value);
      setBaseline(value);
      setLoaded(true);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load template document"
      );
      setLoaded(true);
    }
  }, [template.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !loaded) return;
    el.innerHTML = draft;
  }, [loaded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dirty) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, dirty]);

  function syncDraftFromEditor() {
    if (editorRef.current) {
      setDraft(editorRef.current.innerHTML);
    }
  }

  function handleInsertVariable(key: string) {
    const token = `{${key}}`;
    if (!insertTextAtSelection(token)) {
      setDraft((current) => `${current}${token}`);
      if (editorRef.current) {
        editorRef.current.innerHTML = `${editorRef.current.innerHTML}${token}`;
      }
    } else {
      syncDraftFromEditor();
    }
  }

  function handleInsertCustomVariable() {
    const key = customVariable.trim().replace(/[{}]/g, "");
    if (!key) return;
    handleInsertVariable(key);
    setCustomVariable("");
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const content = editorRef.current?.innerHTML ?? draft;
      const updated = await adminSaveSkTemplateContent(template.id, content);
      setDraft(content);
      setBaseline(content);
      onSaved(updated);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(baseline);
    if (editorRef.current) {
      editorRef.current.innerHTML = baseline;
    }
    setSaveError("");
    onClose();
  }

  const insertKeys = Array.from(
    new Set(template.variables.map((variable) => variable.key))
  ).sort();

  return (
    <div className={styles.wardTemplateEditorBackdrop} role="presentation">
      <div
        className={styles.wardTemplateEditor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sk-template-editor-title"
      >
        <header className={styles.wardTemplateEditorHeader}>
          <div>
            <h3 id="sk-template-editor-title">Edit Sajilo Kanun template</h3>
            <p className={styles.skEditUserHint}>
              {template.name.en} — {courtLabel} / {template.documentKindTitle}. Use
              placeholders like {"{applicant_name}"}. Variables re-detect on save.
            </p>
            {saveError ? <p className={styles.formError}>{saveError}</p> : null}
          </div>
          <div className={styles.wardTemplateEditorActions}>
            <button type="button" className={styles.skSmallBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => void handleSave()}
              disabled={!dirty || saving || !loaded || Boolean(loadError)}
            >
              {saving ? "Saving…" : "Save document"}
            </button>
          </div>
        </header>

        {!loaded ? (
          <p className={styles.panelDesc}>Loading document…</p>
        ) : loadError ? (
          <p className={styles.formError}>{loadError}</p>
        ) : (
          <>
            <div className={styles.wardTemplateEditorToolbar}>
              <span className={styles.wardTemplateEditorToolbarLabel}>
                Insert variable:
              </span>
              <div className={styles.wardTemplateEditorChips}>
                {insertKeys.length === 0 ? (
                  <span className={styles.panelDesc}>
                    No detected variables yet — type {"{key}"} or add below.
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
                  className={styles.filterInput}
                  placeholder="custom_variable"
                  value={customVariable}
                  onChange={(e) => setCustomVariable(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleInsertCustomVariable();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.skSmallBtn}
                  onClick={handleInsertCustomVariable}
                >
                  Insert
                </button>
              </div>
            </div>

            <article
              ref={editorRef}
              className={styles.wardTemplateEditorBody}
              contentEditable
              suppressContentEditableWarning
              onInput={syncDraftFromEditor}
            />
          </>
        )}
      </div>
    </div>
  );
}
