"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  getCaseUploadEditableKind,
  getSajiloKanunToken,
  updateCaseUploadContent,
  type CaseUploadEditableKind,
} from "@/lib/sajilokanun-access";

type CaseFilePreviewPanelProps = {
  url: string;
  title: string;
  mimeType?: string;
  previewable: boolean;
  unsupportedMessage: string;
  canEdit?: boolean;
  caseId?: string;
  uploadId?: string;
  labels: {
    close: string;
    edit: string;
    save: string;
    saving: string;
    cancelEdit: string;
    editHint: string;
    saved: string;
    loadingPreview: string;
  };
  onClose: () => void;
  onSaved?: (updated: { id: string; size: number; updatedAt: string }) => void;
};

const DOC_ARTICLE_CLASS =
  "mx-auto max-w-3xl rounded-lg bg-white px-6 py-8 text-[15px] leading-relaxed text-[#1a1a1a] shadow-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/30 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#ddd] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#ddd] [&_th]:px-2 [&_th]:py-1 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6";

export function CaseFilePreviewPanel({
  url,
  title,
  mimeType,
  previewable,
  unsupportedMessage,
  canEdit = false,
  caseId,
  uploadId,
  labels,
  onClose,
  onSaved,
}: CaseFilePreviewPanelProps) {
  const editableKind: CaseUploadEditableKind | null = getCaseUploadEditableKind(
    title,
    mimeType
  );
  const allowEdit = Boolean(canEdit && editableKind && caseId && uploadId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(url);
  const editorRef = useRef<HTMLElement | null>(null);
  const ownedPreviewUrlRef = useRef<string | null>(null);

  const dirty = editing && draft !== baseline;

  const loadContent = useCallback(async (sourceUrl: string, kind: CaseUploadEditableKind) => {
    setLoaded(false);
    setLoadError("");
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error("Failed to load document");
      let value = "";
      if (kind === "txt") {
        value = await res.text();
      } else {
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        value = result.value || "<p></p>";
      }
      setDraft(value);
      setBaseline(value);
      setLoaded(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to preview document");
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setPreviewUrl(url);
    setEditing(false);
    setSaveError("");
    setSaveOk(false);
    if (editableKind) {
      void loadContent(url, editableKind);
    } else {
      setLoaded(true);
      setLoadError("");
    }
  }, [url, title, editableKind, loadContent]);

  useEffect(() => {
    return () => {
      if (ownedPreviewUrlRef.current) {
        URL.revokeObjectURL(ownedPreviewUrlRef.current);
        ownedPreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editing || editableKind !== "docx") return;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = draft;
    // Seed editor only when entering edit mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: seed once per edit session
  }, [editing, editableKind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editing && dirty) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, editing, dirty]);

  async function handleSave() {
    if (!caseId || !uploadId || !dirty || saving) return;
    setSaving(true);
    setSaveError("");
    setSaveOk(false);
    try {
      const content =
        editableKind === "docx" && editorRef.current
          ? editorRef.current.innerHTML
          : draft;
      const updated = await updateCaseUploadContent(caseId, uploadId, content);
      setDraft(content);
      setBaseline(content);
      setSaveOk(true);
      onSaved?.({
        id: updated.id,
        size: updated.size,
        updatedAt: updated.updatedAt,
      });

      const token = getSajiloKanunToken();
      if (token) {
        const res = await fetch(
          `/api/sajilokanun-auth/cases/${caseId}/uploads/${uploadId}/download`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const blob = await res.blob();
          const nextUrl = URL.createObjectURL(blob);
          if (ownedPreviewUrlRef.current) {
            URL.revokeObjectURL(ownedPreviewUrlRef.current);
          }
          ownedPreviewUrlRef.current = nextUrl;
          setPreviewUrl(nextUrl);
        }
      }
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setDraft(baseline);
    setEditing(false);
    setSaveError("");
    setSaveOk(false);
  }

  const mime = (mimeType ?? "").toLowerCase();
  const isPdf = mime.includes("pdf") || title.toLowerCase().endsWith(".pdf");
  const isImage = mime.startsWith("image/");

  const headerBtnClass =
    "shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={labels.close}
        onClick={onClose}
      />

      <aside
        className="relative z-10 mx-auto flex h-full w-full max-w-5xl flex-col bg-[var(--surface)] shadow-2xl sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-xl sm:border sm:border-[var(--border)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-snug">{title}</p>
            {allowEdit && editing ? (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{labels.editHint}</p>
            ) : null}
            {saveError ? (
              <p className="mt-0.5 text-xs text-red-600">{saveError}</p>
            ) : null}
            {saveOk && !dirty ? (
              <p className="mt-0.5 text-xs text-emerald-700">{labels.saved}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allowEdit && !editing && loaded && !loadError ? (
              <button
                type="button"
                className={headerBtnClass}
                onClick={() => {
                  setEditing(true);
                  setSaveOk(false);
                  setSaveError("");
                }}
              >
                {labels.edit}
              </button>
            ) : null}
            {allowEdit && editing ? (
              <>
                <button
                  type="button"
                  className={headerBtnClass}
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  {labels.cancelEdit}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleSave()}
                  disabled={!dirty || saving}
                >
                  {saving ? labels.saving : labels.save}
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} className={headerBtnClass}>
              {labels.close}
            </button>
          </div>
        </header>

        {!previewable ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--surface-muted)] p-6">
            <p className="max-w-md text-center text-sm text-[var(--muted)]">
              {unsupportedMessage}
            </p>
          </div>
        ) : !loaded ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--surface-muted)] p-6">
            <p className="text-sm text-[var(--muted)]">{labels.loadingPreview}</p>
          </div>
        ) : loadError && editableKind ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--surface-muted)] p-6">
            <p className="max-w-md text-center text-sm text-[var(--muted)]">{loadError}</p>
          </div>
        ) : editableKind === "docx" ? (
          <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-muted)] p-4 sm:p-6 sm:rounded-b-xl">
            {editing ? (
              <article
                ref={editorRef}
                className={DOC_ARTICLE_CLASS}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => {
                  setDraft((event.currentTarget as HTMLElement).innerHTML);
                  setSaveOk(false);
                }}
              />
            ) : (
              <article
                className={DOC_ARTICLE_CLASS}
                dangerouslySetInnerHTML={{ __html: draft }}
              />
            )}
          </div>
        ) : editableKind === "txt" ? (
          editing ? (
            <div className="min-h-0 flex-1 bg-[var(--surface-muted)] p-4 sm:rounded-b-xl">
              <textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSaveOk(false);
                }}
                className="h-full min-h-[50vh] w-full resize-none rounded-lg border border-[var(--border)] bg-white p-4 font-mono text-sm leading-relaxed text-[#1a1a1a] outline-none focus:border-[var(--primary)]"
                spellCheck
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-muted)] p-4 sm:p-6 sm:rounded-b-xl">
              <pre className="mx-auto max-w-3xl whitespace-pre-wrap break-words rounded-lg bg-white px-6 py-8 font-mono text-sm leading-relaxed text-[#1a1a1a] shadow-sm">
                {draft}
              </pre>
            </div>
          )
        ) : isImage ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--surface-muted)] p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={title} className="max-h-full max-w-full object-contain" />
          </div>
        ) : isPdf ? (
          <embed
            key={previewUrl}
            src={previewUrl}
            type="application/pdf"
            title={title}
            className="min-h-0 w-full flex-1 border-0 bg-[var(--surface-muted)] sm:rounded-b-xl"
          />
        ) : (
          <iframe
            key={previewUrl}
            src={previewUrl}
            title={title}
            className="min-h-0 w-full flex-1 border-0 bg-[var(--surface-muted)] sm:rounded-b-xl"
          />
        )}
      </aside>
    </div>
  );
}
