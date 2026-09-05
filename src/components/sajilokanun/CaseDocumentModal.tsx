"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCaseDetail,
  fetchSkTemplateFields,
  generateSkCaseDocumentWithAi,
  isFirmQuotaError,
  previewSkCaseDocument,
  saveSkCaseDocument,
  type CaseUploadedDocumentRecord,
  type SkPublishedDocumentTemplate,
  type SkTemplateFormField,
} from "@/lib/sajilokanun-access";
import {
  normalizeExtractedCaseDocument,
  type ExtractedCaseDocument,
} from "@/lib/sajilokanun/document-prompts";
import { mapExtractionToSkValues } from "@/lib/sajilokanun/map-extraction-to-sk-values";
import { docxToPreviewHtml } from "@/lib/sajilokanun/docx-to-preview-html";
import {
  MissingRequiredFieldsDialog,
  listMissingRequiredLabels,
} from "@/components/MissingRequiredFieldsDialog";
import { VoiceFillRow } from "@/components/VoiceFillButton";
import styles from "./CaseDocumentModal.module.css";

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

function fieldLabel(field: SkTemplateFormField): string {
  const ne = field.label.ne?.trim() || "";
  const en = field.label.en?.trim() || "";
  if (ne && en && ne !== en) {
    return `${ne} (${en})`;
  }
  return ne || en || field.key;
}

function sectionTitle(section: string): string {
  if (!section) return "";
  if (section.startsWith("plaintiff") || section.startsWith("petitioner")) {
    return "वादी / निवेदक (Plaintiff)";
  }
  if (section.startsWith("defendant") || section.startsWith("respondent")) {
    return "प्रतिवादी / विपक्षी (Defendant)";
  }
  if (section === "court") return "अदालत (Court)";
  if (section === "case") return "मुद्दा (Case)";
  if (section === "facts") return "तथ्य (Facts)";
  if (section === "claims") return "दाबी (Claims)";
  if (section === "evidence") return "प्रमाण (Evidence)";
  if (section === "other") return "अन्य (Other)";
  return section;
}

function orderFieldsByTemplate(
  userFields: SkTemplateFormField[],
  placeholderKeys: string[]
): SkTemplateFormField[] {
  const byKey = new Map(userFields.map((field) => [field.key, field]));
  const ordered: SkTemplateFormField[] = [];
  for (const key of placeholderKeys) {
    const field = byKey.get(key);
    if (field) ordered.push(field);
  }
  for (const field of userFields) {
    if (!placeholderKeys.includes(field.key)) ordered.push(field);
  }
  return ordered;
}

export function CaseDocumentModal({
  caseId,
  template,
  locale = "ne",
  onClose,
  onSaved,
  onQuotaError,
}: CaseDocumentModalProps) {
  const [userFields, setUserFields] = useState<SkTemplateFormField[]>([]);
  const [placeholderKeys, setPlaceholderKeys] = useState<string[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [autofillBanner, setAutofillBanner] = useState("");
  const [caseVitals, setCaseVitals] = useState<ExtractedCaseDocument | null>(null);
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState("");
  const [missingRequired, setMissingRequired] = useState<string[] | null>(null);
  const [pendingIncompleteAction, setPendingIncompleteAction] = useState<
    "generate" | "save" | null
  >(null);
  const previewDocRef = useRef<HTMLDivElement | null>(null);

  const title =
    locale === "ne"
      ? template.name.ne || template.name.en
      : template.name.en || template.name.ne;

  const hasGenerated = Boolean(generatedBlob);

  const orderedFields = useMemo(
    () => orderFieldsByTemplate(userFields, placeholderKeys),
    [userFields, placeholderKeys]
  );

  function missingRequiredLabels(): string[] {
    return listMissingRequiredLabels(
      orderedFields
        .filter(
          (field) =>
            !/^blank_\d+$/i.test(field.key) && !/^unknown_\d+$/i.test(field.key)
        )
        .map((field) => ({
          key: field.key,
          required: field.required,
          label: fieldLabel(field),
        })),
      values
    );
  }

  function confirmOrRun(action: "generate" | "save", allowIncomplete: boolean) {
    if (!allowIncomplete) {
      const missing = missingRequiredLabels();
      if (missing.length > 0) {
        setMissingRequired(missing);
        setPendingIncompleteAction(action);
        return false;
      }
    }
    setMissingRequired(null);
    setPendingIncompleteAction(null);
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFieldsLoading(true);
      setError("");
      setAutofillBanner("");
      setCaseVitals(null);
      setGeneratedBlob(null);
      setGeneratedFileName("");
      try {
        const [fields, detail] = await Promise.all([
          fetchSkTemplateFields(template.id),
          fetchCaseDetail(caseId).catch(() => null),
        ]);
        if (cancelled) return;
        setUserFields(fields.userFields);
        setPlaceholderKeys(fields.placeholderKeys);

        const initial: Record<string, string> = {};
        for (const field of fields.userFields) {
          initial[field.key] = "";
        }

        const rawFacts = detail?.documentExtraction?.facts;
        if (rawFacts && typeof rawFacts === "object") {
          const extracted = normalizeExtractedCaseDocument(rawFacts);
          setCaseVitals(extracted);
          const mapped = mapExtractionToSkValues(extracted, fields.userFields);
          for (const [key, value] of Object.entries(mapped.values)) {
            if (key in initial) initial[key] = value;
          }
          if (mapped.filledCount > 0) {
            setAutofillBanner(
              locale === "ne"
                ? `यस मुद्दाको OCR बाट ${mapped.filledCount} फिल्ड भरियो — Generate थिचेर Gemini ले टेम्प्लेट भर्छ।`
                : `Filled ${mapped.filledCount} fields from this case’s OCR — click Generate for Gemini to fill the template.`
            );
          } else {
            setAutofillBanner(
              locale === "ne"
                ? "यस मुद्दामा OCR छ, तर यस फारमका फिल्डसँग मिल्ने कुञ्जी भेटिएन।"
                : "This case has OCR vitals, but no keys matched this form yet."
            );
          }
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
    void load();
    return () => {
      cancelled = true;
    };
  }, [template.id, caseId, locale]);

  const refreshPreview = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const { blob } = await previewSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: values,
      });
      setPreviewHtml(await docxToPreviewHtml(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview document");
    } finally {
      setBusy(false);
    }
  }, [caseId, template.id, values]);

  useEffect(() => {
    if (fieldsLoading || userFields.length === 0) return;
    void refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsLoading, template.id, caseId]);

  useEffect(() => {
    const container = previewDocRef.current;
    if (!container) return;

    container.querySelectorAll("[data-sk-field].sk-preview-field-active").forEach((node) => {
      node.classList.remove("sk-preview-field-active");
    });

    if (!activeFieldKey) return;

    const targets = container.querySelectorAll(
      `[data-sk-field="${CSS.escape(activeFieldKey)}"]`
    );
    if (targets.length === 0) return;

    targets.forEach((node) => {
      node.classList.add("sk-preview-field-active");
    });
    targets[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFieldKey, previewHtml]);

  function handleFieldFocus(fieldKey: string) {
    setActiveFieldKey(fieldKey);
  }

  function invalidateGenerated() {
    if (generatedBlob) {
      setGeneratedBlob(null);
      setGeneratedFileName("");
    }
  }

  async function handleGenerate(options?: { allowIncomplete?: boolean }) {
    if (!confirmOrRun("generate", Boolean(options?.allowIncomplete))) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateSkCaseDocumentWithAi({
        caseId,
        templateId: template.id,
        variables: values,
      });
      setValues((prev) => ({ ...prev, ...result.values }));
      setGeneratedBlob(result.blob);
      setGeneratedFileName(result.fileName);
      setPreviewHtml(await docxToPreviewHtml(result.blob));
      setAutofillBanner(
        locale === "ne"
          ? `Gemini ले ${result.filledCount} फिल्ड भर्‍यो — डाउनलोड वा केस कागजातमा सेभ गर्न सकिन्छ।`
          : `Gemini filled ${result.filledCount} fields — you can download or save to case documents.`
      );
    } catch (err) {
      if (isFirmQuotaError(err) && err.code === "firm_documents_quota") {
        onQuotaError?.({ code: err.code, used: err.used, limit: err.limit });
      }
      setError(
        err instanceof Error ? err.message : "Failed to generate document with AI"
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadGenerated() {
    if (!generatedBlob) return;
    const url = URL.createObjectURL(generatedBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = generatedFileName || "document.docx";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveGenerated(options?: { allowIncomplete?: boolean }) {
    if (!generatedBlob) return;
    if (!confirmOrRun("save", Boolean(options?.allowIncomplete))) return;
    setBusy(true);
    setError("");
    try {
      const { upload } = await saveSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: values,
        allowIncomplete: options?.allowIncomplete === true,
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

  function reapplyOcr() {
    if (!caseVitals) return;
    const mapped = mapExtractionToSkValues(caseVitals, userFields);
    setValues((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(mapped.values)) {
        if (value) next[key] = value;
      }
      return next;
    });
    invalidateGenerated();
    setAutofillBanner(
      locale === "ne"
        ? `OCR बाट फेरि ${mapped.filledCount} फिल्ड भरियो।`
        : `Re-applied ${mapped.filledCount} OCR fields.`
    );
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (missingRequired && missingRequired.length > 0) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [missingRequired, onClose]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
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
              {locale === "ne"
                ? "बायाँ: फिल्ड जाँच · Generate: Gemini ले टेम्प्लेट भर्छ"
                : "Left: review fields · Generate: Gemini fills the DOCX template"}
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}
        {autofillBanner ? (
          <p className={styles.autofillBanner} role="status">
            {autofillBanner}
          </p>
        ) : null}

        {fieldsLoading ? (
          <div className={styles.modalBody}>
            <p className={styles.muted}>Loading template fields…</p>
          </div>
        ) : (
          <div className={styles.modalBody}>
            <div className={styles.splitLayout}>
              <aside className={styles.editPane}>
                <div className={styles.paneHeader}>
                  <h3>
                    {locale === "ne" ? "फारम फिल्डहरू" : "Form fields"}
                    <span className={styles.muted}>
                      {" "}
                      ({userFields.length})
                    </span>
                  </h3>
                  {caseVitals ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={reapplyOcr}
                      disabled={busy || generating}
                    >
                      {locale === "ne" ? "OCR फेरि लागू" : "Re-apply OCR"}
                    </button>
                  ) : null}
                </div>
                {userFields.length === 0 ? (
                  <p className={styles.muted}>
                    This template has no fillable placeholders.
                  </p>
                ) : (
                  <div className={styles.formScroll}>
                    <div className={styles.form}>
                      {orderedFields.map((field, index) => {
                        const section = field.section?.trim() || "";
                        const sectionLabel = sectionTitle(section);
                        return (
                          <label
                            key={field.key}
                            className={`${styles.field} ${
                              activeFieldKey === field.key ? styles.fieldActive : ""
                            }`}
                          >
                            <span className={styles.fieldLabelRow}>
                              <span className={styles.fieldIndex}>{index + 1}.</span>
                              <span>
                                {fieldLabel(field)}
                                {field.required ? " *" : ""}
                              </span>
                            </span>
                            {sectionLabel ? (
                              <span className={styles.fieldSection}>{sectionLabel}</span>
                            ) : null}
                            {field.type === "date" ? (
                              <input
                                type="date"
                                value={values[field.key] ?? ""}
                                onFocus={() => handleFieldFocus(field.key)}
                                onChange={(e) => {
                                  invalidateGenerated();
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }));
                                }}
                                placeholder={field.key}
                              />
                            ) : (
                              <VoiceFillRow
                                locale={locale}
                                lang="ne-NP"
                                disabled={busy || generating}
                                onTranscript={(text) => {
                                  invalidateGenerated();
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: text,
                                  }));
                                }}
                              >
                                <input
                                  type={
                                    field.type === "number" ? "number" : "text"
                                  }
                                  value={values[field.key] ?? ""}
                                  onFocus={() => handleFieldFocus(field.key)}
                                  onChange={(e) => {
                                    invalidateGenerated();
                                    setValues((prev) => ({
                                      ...prev,
                                      [field.key]: e.target.value,
                                    }));
                                  }}
                                  placeholder={field.key}
                                />
                              </VoiceFillRow>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </aside>

              <section className={styles.previewPane}>
                <div className={styles.paneHeader}>
                  <h3>
                    {hasGenerated
                      ? locale === "ne"
                        ? "जेनेरेट गरिएको कागजात"
                        : "Generated document"
                      : locale === "ne"
                        ? "टेम्प्लेट पूर्वावलोकन"
                        : "Template preview"}
                  </h3>
                  {!hasGenerated ? (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => void refreshPreview()}
                      disabled={busy || generating}
                    >
                      {busy
                        ? locale === "ne"
                          ? "अपडेट…"
                          : "Updating…"
                        : locale === "ne"
                          ? "पूर्वावलोकन अपडेट"
                          : "Update preview"}
                    </button>
                  ) : null}
                </div>
                {previewHtml ? (
                  <div
                    ref={previewDocRef}
                    className={styles.previewDoc}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <p className={styles.muted}>
                    {busy || generating
                      ? generating
                        ? locale === "ne"
                          ? "Gemini ले कागजात बनाउँदैछ…"
                          : "Gemini is generating the document…"
                        : "Building preview…"
                      : "Preview will appear here after the template loads."}
                  </p>
                )}
              </section>
            </div>

            <footer className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              {!hasGenerated ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleGenerate()}
                  disabled={busy || generating || userFields.length === 0}
                >
                  {generating
                    ? locale === "ne"
                      ? "जेनेरेट हुँदैछ…"
                      : "Generating…"
                    : locale === "ne"
                      ? "Generate"
                      : "Generate"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => void handleGenerate()}
                    disabled={busy || generating}
                  >
                    {generating
                      ? locale === "ne"
                        ? "फेरि जेनेरेट…"
                        : "Regenerating…"
                      : locale === "ne"
                        ? "फेरि Generate"
                        : "Regenerate"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={handleDownloadGenerated}
                    disabled={busy || generating}
                  >
                    {locale === "ne" ? "डाउनलोड" : "Download"}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleSaveGenerated()}
                    disabled={busy || generating}
                  >
                    {busy
                      ? locale === "ne"
                        ? "सेभ हुँदैछ…"
                        : "Saving…"
                      : locale === "ne"
                        ? "केस कागजातमा सेभ"
                        : "Save to case Documents"}
                  </button>
                </>
              )}
            </footer>
          </div>
        )}
      </div>
      {missingRequired && missingRequired.length > 0 ? (
        <MissingRequiredFieldsDialog
          items={missingRequired}
          locale={locale}
          onClose={() => {
            setMissingRequired(null);
            setPendingIncompleteAction(null);
          }}
          onContinue={() => {
            if (pendingIncompleteAction === "save") {
              void handleSaveGenerated({ allowIncomplete: true });
              return;
            }
            void handleGenerate({ allowIncomplete: true });
          }}
        />
      ) : null}
    </div>
  );
}

