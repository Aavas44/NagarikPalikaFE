"use client";

import { useCallback, useEffect, useState } from "react";
import mammoth from "mammoth";
import {
  fetchSkTemplateFields,
  generateSkCaseDocument,
  isFirmQuotaError,
  previewSkCaseDocument,
  saveSkCaseDocument,
  type CaseUploadedDocumentRecord,
  type SkPublishedDocumentTemplate,
  type SkTemplateFormField,
} from "@/lib/sajilokanun-access";
import styles from "./CaseDocumentModal.module.css";

type FlowStep = "fill" | "preview";

type CaseDocumentModalProps = {
  caseId: string;
  template: SkPublishedDocumentTemplate;
  locale?: "en" | "ne";
  onClose: () => void;
  onSaved: (upload: CaseUploadedDocumentRecord) => void;
  onQuotaError?: (err: {
    code: string;
    used: number;
    limit: number;
  }) => void;
};

function fieldLabel(field: SkTemplateFormField, locale: "en" | "ne"): string {
  if (locale === "ne") {
    return field.label.ne || field.label.en || field.key;
  }
  return field.label.en || field.label.ne || field.key;
}

export function CaseDocumentModal({
  caseId,
  template,
  locale = "ne",
  onClose,
  onSaved,
  onQuotaError,
}: CaseDocumentModalProps) {
  const [step, setStep] = useState<FlowStep>("fill");
  const [userFields, setUserFields] = useState<SkTemplateFormField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title =
    locale === "ne"
      ? template.name.ne || template.name.en
      : template.name.en || template.name.ne;

  useEffect(() => {
    let cancelled = false;
    async function loadFields() {
      setFieldsLoading(true);
      setError("");
      try {
        const fields = await fetchSkTemplateFields(template.id);
        if (cancelled) return;
        setUserFields(fields.userFields);
        const initial: Record<string, string> = {};
        for (const field of fields.userFields) {
          initial[field.key] = "";
        }
        setValues(initial);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load template fields"
          );
        }
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    }
    void loadFields();
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  const refreshPreview = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, fileName } = await previewSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: values,
      });
      const arrayBuffer = await blob.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setPreviewHtml(result.value);
      setPreviewFileName(fileName);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview document");
    } finally {
      setBusy(false);
    }
  }, [caseId, template.id, values]);

  async function handleFillSubmit(e: React.FormEvent) {
    e.preventDefault();
    await refreshPreview();
  }

  async function handleDownload() {
    setBusy(true);
    setError("");
    try {
      const { blob, fileName } = await generateSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: values,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (isFirmQuotaError(err) && err.code === "firm_documents_quota") {
        onQuotaError?.({ code: err.code, used: err.used, limit: err.limit });
      }
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveToCase() {
    setBusy(true);
    setError("");
    try {
      const { upload } = await saveSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: values,
      });
      onSaved(upload);
      onClose();
    } catch (err) {
      if (isFirmQuotaError(err) && err.code === "firm_documents_quota") {
        onQuotaError?.({ code: err.code, used: err.used, limit: err.limit });
      }
      setError(
        err instanceof Error ? err.message : "Failed to save document to case files"
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-doc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="case-doc-modal-title">{title}</h2>
            {template.name.roman ? (
              <p className={styles.muted} style={{ margin: "0.2rem 0 0" }}>
                {template.name.roman}
              </p>
            ) : null}
            <p className={styles.muted}>
              {step === "fill"
                ? "Fill the form fields, then preview the filled petition."
                : "Review the preview, edit fields if needed, then download or save to case Documents."}
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}

        {fieldsLoading ? (
          <div className={styles.modalBody}>
            <p className={styles.muted}>Loading template fields…</p>
          </div>
        ) : step === "fill" ? (
          <form onSubmit={handleFillSubmit} className={styles.modalBody}>
            <section className={styles.modalSection}>
              <h3>Form fields</h3>
              {userFields.length === 0 ? (
                <p className={styles.muted}>
                  This template has no fillable placeholders.
                </p>
              ) : (
                <div className={styles.form}>
                  {userFields.map((field) => (
                    <label key={field.key} className={styles.field}>
                      <span>
                        {fieldLabel(field, locale)}
                        {field.required ? " *" : ""}
                      </span>
                      <input
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={values[field.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        required={field.required}
                        placeholder={fieldLabel(field, locale)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Building preview…" : "Preview document"}
              </button>
            </footer>
          </form>
        ) : (
          <div className={styles.modalBody}>
            <div className={styles.previewLayout}>
              <section className={styles.previewPane}>
                <h3>Document preview</h3>
                {previewHtml ? (
                  <div
                    className={styles.previewDoc}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <p className={styles.muted}>No preview available.</p>
                )}
              </section>

              <aside className={styles.editPane}>
                <h3>Edit fields</h3>
                <div className={styles.form}>
                  {userFields.map((field) => (
                    <label key={field.key} className={styles.field}>
                      <span>
                        {fieldLabel(field, locale)}
                        {field.required ? " *" : ""}
                      </span>
                      <input
                        type={
                          field.type === "number"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={values[field.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        required={field.required}
                      />
                    </label>
                  ))}
                </div>
              </aside>
            </div>

            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setStep("fill")}
                disabled={busy}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void refreshPreview()}
                disabled={busy}
              >
                {busy ? "Updating…" : "Update preview"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void handleDownload()}
                disabled={busy}
              >
                {busy
                  ? "Working…"
                  : `Download${previewFileName ? ` (${previewFileName})` : ""}`}
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void handleSaveToCase()}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save to case Documents"}
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
