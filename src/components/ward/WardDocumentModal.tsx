"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  wardFetchMe,
  wardFetchTemplateFields,
  wardGenerateDocument,
  wardDocxFromEditedHtml,
  wardLocalizeVariables,
  wardPreviewDocument,
  type WardDocumentTemplate,
  type WardOperatorProfile,
  type WardTemplateVariable,
} from "@/lib/ward-access";
import {
  buildInitialWardDocumentValues,
  formatApplicantAddressFromParts,
  wardProfileValueForKey,
  WARD_AUTO_FIELD_META,
} from "@/lib/ward-profile-variables";
import { wardBilingualFieldLabel } from "@/lib/ward-field-labels-ne";
import {
  docxToEditableHtml,
  docxToPreviewHtml,
} from "@/lib/sajilokanun/docx-to-preview-html";
import {
  applyValuesToSkPreviewHtml,
  skPreviewHtmlHasFieldMarks,
} from "@/lib/sajilokanun/mark-sk-preview-fields";
import {
  MissingRequiredFieldsDialog,
  listMissingRequiredLabels,
} from "@/components/MissingRequiredFieldsDialog";
import { VoiceFillRow } from "@/components/VoiceFillButton";
import styles from "@/app/ward/ward.module.css";

function RegenerateIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

type WardDocumentModalProps = {
  template: WardDocumentTemplate;
  profile: WardOperatorProfile;
  quotaExhausted: boolean;
  onClose: () => void;
  /** Called after a successful Generate (quota consumed) with refreshed profile. */
  onDownloaded: (profile: WardOperatorProfile) => void;
};

function fieldLabel(variable: WardTemplateVariable): string {
  return wardBilingualFieldLabel(variable.key, variable.label.ne, variable.label.en);
}

function orderFieldsByTemplate(
  userFields: WardTemplateVariable[],
  placeholderKeys: string[]
): WardTemplateVariable[] {
  const byKey = new Map(userFields.map((field) => [field.key, field]));
  const ordered: WardTemplateVariable[] = [];
  for (const key of placeholderKeys) {
    const field = byKey.get(key);
    if (field) ordered.push(field);
  }
  for (const field of userFields) {
    if (!placeholderKeys.includes(field.key)) ordered.push(field);
  }
  return ordered;
}

export function WardDocumentModal({
  template,
  profile,
  quotaExhausted,
  onClose,
  onDownloaded,
}: WardDocumentModalProps) {
  const [userFields, setUserFields] = useState<WardTemplateVariable[]>([]);
  const [placeholderKeys, setPlaceholderKeys] = useState<string[]>([]);
  const [autoFieldKeys, setAutoFieldKeys] = useState<string[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [statusBanner, setStatusBanner] = useState("");
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState("");
  const [previewEditorSeed, setPreviewEditorSeed] = useState(0);
  const [previewEdited, setPreviewEdited] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[] | null>(null);
  const previewDocRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const valuesRef = useRef(values);
  const generatedBlobRef = useRef(generatedBlob);
  const templatePreviewHtmlRef = useRef("");
  const fieldLabelByKeyRef = useRef<Map<string, string>>(new Map());
  const profileRef = useRef(profile);
  profileRef.current = profile;

  valuesRef.current = values;
  generatedBlobRef.current = generatedBlob;

  const title = template.name.ne || template.name.en;
  const englishTitle =
    template.name.en && template.name.en !== title ? template.name.en : "";

  const hasGenerated = Boolean(generatedBlob);

  const orderedFields = useMemo(
    () => orderFieldsByTemplate(userFields, placeholderKeys),
    [userFields, placeholderKeys]
  );

  const autoFields = useMemo(() => {
    const metaByKey = new Map(WARD_AUTO_FIELD_META.map((field) => [field.key, field]));
    const keys = [...autoFieldKeys];
    for (const field of userFields) {
      if (keys.includes(field.key)) continue;
      if (wardProfileValueForKey(profile, field.key)?.trim()) {
        keys.push(field.key);
      }
    }
    return keys.map((key) => {
      const userField = userFields.find((field) => field.key === key);
      return {
        key,
        label:
          metaByKey.get(key)?.label ??
          (userField ? fieldLabel(userField) : wardBilingualFieldLabel(key)),
      };
    });
  }, [autoFieldKeys, profile, userFields]);

  const citizenFields = useMemo(() => {
    const autoKeys = new Set(autoFields.map((field) => field.key));
    return orderedFields.filter((field) => !autoKeys.has(field.key));
  }, [autoFields, orderedFields]);

  useEffect(() => {
    let cancelled = false;
    async function loadFields() {
      setFieldsLoading(true);
      setError("");
      setStatusBanner("");
      setPreviewHtml("");
      setGeneratedBlob(null);
      setGeneratedFileName("");
      generatedBlobRef.current = null;
      setPreviewEdited(false);
      templatePreviewHtmlRef.current = "";
      setActiveFieldKey(null);
      try {
        const fields = await wardFetchTemplateFields(template.id);
        if (cancelled) return;
        setUserFields(fields.userFields);
        setPlaceholderKeys(fields.placeholderKeys);
        setAutoFieldKeys(fields.autoFieldKeys);
        setValues(
          buildInitialWardDocumentValues(
            profileRef.current,
            fields.userFields,
            fields.placeholderKeys
          )
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load template fields");
        }
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    }
    void loadFields();
    return () => {
      cancelled = true;
    };
    // Only reset when the template changes — not when parent refreshes profile
    // after Generate (that was wiping generatedBlob / Download UI).
  }, [template.id]);

  useEffect(() => {
    const labels = new Map<string, string>();
    for (const field of autoFields) {
      labels.set(field.key, field.label);
    }
    for (const field of userFields) {
      labels.set(field.key, fieldLabel(field));
    }
    fieldLabelByKeyRef.current = labels;
  }, [autoFields, userFields]);

  function previewDisplayForKey(key: string, value: string): string {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return fieldLabelByKeyRef.current.get(key) || key;
  }

  function paintedPreviewHtml(
    baseHtml: string,
    nextValues: Record<string, string>
  ): string {
    return applyValuesToSkPreviewHtml(baseHtml, nextValues, previewDisplayForKey);
  }

  const loadTemplatePreview = useCallback(async () => {
    if (generatedBlobRef.current) return;
    const requestValues = valuesRef.current;
    setBusy(true);
    setError("");
    try {
      const { blob } = await wardPreviewDocument({
        templateId: template.id,
        variables: requestValues,
        skipLocalize: true,
      });
      if (generatedBlobRef.current) return;
      const html = await docxToPreviewHtml(blob);
      templatePreviewHtmlRef.current = html;
      if (!skPreviewHtmlHasFieldMarks(html)) {
        setPreviewHtml(html);
        setStatusBanner(
          "पूर्वावलोकन मार्कर भेटिएन — Generate पछि मात्र अन्तिम कागजात देखिन्छ।"
        );
      } else {
        setPreviewHtml(paintedPreviewHtml(html, valuesRef.current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview document");
    } finally {
      setBusy(false);
    }
  }, [template.id]);

  useEffect(() => {
    if (fieldsLoading) return;
    void loadTemplatePreview();
  }, [fieldsLoading, template.id, loadTemplatePreview]);

  useEffect(() => {
    const container = previewDocRef.current;
    if (!container) return;

    container.querySelectorAll("[data-sk-field].sk-preview-field-active").forEach((node) => {
      node.classList.remove("sk-preview-field-active");
    });

    if (!activeFieldKey || generatedBlob) return;

    const targets = container.querySelectorAll(
      `[data-sk-field="${CSS.escape(activeFieldKey)}"]`
    );
    if (targets.length === 0) return;

    targets.forEach((node) => {
      node.classList.add("sk-preview-field-active");
    });
  }, [activeFieldKey, previewHtml, generatedBlob]);

  useEffect(() => {
    if (!activeFieldKey || generatedBlob) return;
    const container = previewDocRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-sk-field="${CSS.escape(activeFieldKey)}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFieldKey, generatedBlob]);

  useEffect(() => {
    if (!hasGenerated || !previewDocRef.current) return;
    previewDocRef.current.innerHTML = previewHtml;
    setPreviewEdited(false);
  }, [hasGenerated, previewEditorSeed, previewHtml]);

  function restoreTemplatePreview() {
    const base = templatePreviewHtmlRef.current;
    if (base) {
      setPreviewHtml(paintedPreviewHtml(base, valuesRef.current));
      return;
    }
    void loadTemplatePreview();
  }

  function invalidateGenerated() {
    if (generatedBlobRef.current) {
      setGeneratedBlob(null);
      setGeneratedFileName("");
      generatedBlobRef.current = null;
      setPreviewEdited(false);
      setStatusBanner(
        "फिल्ड परिवर्तन भयो — फेरि Generate गर्नुहोस्। (Fields changed — Generate again.)"
      );
      restoreTemplatePreview();
    }
  }

  function updateFieldValue(key: string, value: string) {
    invalidateGenerated();
    const next = { ...valuesRef.current, [key]: value };

    const addressSources = new Set([
      "निवेदकको_स्थानीय_तह",
      "निवेदकको_वडा_नम्बर",
      "निवेदकको_वडा_नं",
      "निवेदकको_जिल्ला",
      "local_body_name",
      "ward_no",
      "district_name",
      "स्थानीय_तह",
      "वडा_नं",
      "वडा_नम्बर",
      "जिल्ला",
    ]);
    if (addressSources.has(key)) {
      const composed = formatApplicantAddressFromParts(
        next.निवेदकको_स्थानीय_तह ||
          next.स्थानीय_तह ||
          next.local_body_name ||
          "",
        next.निवेदकको_वडा_नम्बर ||
          next.निवेदकको_वडा_नं ||
          next.वडा_नम्बर ||
          next.वडा_नं ||
          next.ward_no ||
          "",
        next.निवेदकको_जिल्ला || next.जिल्ला || next.district_name || ""
      );
      if (composed) {
        next.निवेदकको_ठेगाना = composed;
        if ("applicant_address" in next) next.applicant_address = composed;
        if ("हालको_ठेगाना" in next) next.हालको_ठेगाना = composed;
        if ("current_address" in next) next.current_address = composed;
      }
    }

    valuesRef.current = next;
    setValues(next);
    const base = templatePreviewHtmlRef.current;
    if (base && !generatedBlobRef.current && skPreviewHtmlHasFieldMarks(base)) {
      setPreviewHtml(paintedPreviewHtml(base, next));
    }
  }

  async function handleGenerate(options?: { allowIncomplete?: boolean }) {
    if (quotaExhausted) return;
    const missing = listMissingRequiredLabels(
      orderedFields.map((field) => ({
        key: field.key,
        required: field.required,
        label: fieldLabel(field),
      })),
      values
    );
    if (missing.length > 0 && !options?.allowIncomplete) {
      setMissingRequired(missing);
      return;
    }
    setMissingRequired(null);
    setGenerating(true);
    setError("");
    setStatusBanner("");
    try {
      // Only send template user/auto fields — not the profile alias flood.
      const localizeKeys = new Set([
        ...orderedFields.map((field) => field.key),
        ...autoFields.map((field) => field.key),
      ]);
      const localizeInput = Object.fromEntries(
        [...localizeKeys].map((key) => [key, values[key] ?? ""])
      );

      const localized = await wardLocalizeVariables({
        templateId: template.id,
        variables: localizeInput,
      });
      const nextValues = { ...values, ...localized.variables };
      setValues(nextValues);
      valuesRef.current = nextValues;

      const { blob, fileName } = await wardGenerateDocument({
        templateId: template.id,
        variables: nextValues,
        skipLocalize: true,
        allowIncomplete: options?.allowIncomplete === true,
      });
      setGeneratedBlob(blob);
      generatedBlobRef.current = blob;
      setGeneratedFileName(fileName);
      const editableHtml = await docxToEditableHtml(blob);
      setPreviewHtml(editableHtml);
      setPreviewEditorSeed((seed) => seed + 1);
      setPreviewEdited(false);
      setStatusBanner(
        "कागजात तयार भयो — दायाँ पूर्वावलोकनमा सिधै सम्पादन गर्न सकिन्छ (खाली ठाउँ हटाउने आदि), त्यसपछि डाउनलोड गर्नुहोस्।"
      );
      requestAnimationFrame(() => {
        footerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      const me = await wardFetchMe();
      onDownloaded(me.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadGenerated() {
    if (!generatedBlob && !previewDocRef.current) return;
    setDownloading(true);
    setError("");
    try {
      let blob = generatedBlob;
      let fileName = generatedFileName || "document.docx";
      if (previewEdited && previewDocRef.current) {
        const converted = await wardDocxFromEditedHtml({
          html: previewDocRef.current.innerHTML,
          fileName,
        });
        blob = converted.blob;
        fileName = converted.fileName;
        setGeneratedBlob(blob);
        generatedBlobRef.current = blob;
        setPreviewEdited(false);
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloading(false);
    }
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
        aria-labelledby="ward-doc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="ward-doc-modal-title">{title}</h2>
            {englishTitle ? (
              <p className={styles.muted} style={{ margin: "0.2rem 0 0" }}>
                {englishTitle}
              </p>
            ) : null}
            <p className={styles.muted}>
              बायाँ: फिल्ड भर्नुहोस् · दायाँ पूर्वावलोकन तुरुन्तै अपडेट हुन्छ · Generate:
              नेपाली रूपान्तर र डाउनलोडयोग्य कागजात।
            </p>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}
        {statusBanner ? (
          <p className={styles.statusBanner} role="status">
            {statusBanner}
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
                    फारम फिल्डहरू
                    <span className={styles.muted}> ({citizenFields.length})</span>
                  </h3>
                </div>
                <div className={styles.formScroll}>
                  {autoFields.length > 0 ? (
                    <section className={styles.modalSection}>
                      <h3>वडा कार्यालयबाट स्वतः भरिएका विवरण (सच्याउन सकिन्छ)</h3>
                      <div className={styles.autoGrid}>
                        {autoFields.map((field) => (
                          <label
                            key={field.key}
                            className={`${styles.field} ${
                              activeFieldKey === field.key ? styles.fieldActive : ""
                            }`}
                          >
                            <span>{field.label}</span>
                            <VoiceFillRow
                              locale="ne"
                              disabled={generating}
                              onTranscript={(text) =>
                                updateFieldValue(field.key, text)
                              }
                            >
                              <input
                                type="text"
                                value={values[field.key] ?? ""}
                                onFocus={() => setActiveFieldKey(field.key)}
                                onChange={(e) => {
                                  updateFieldValue(field.key, e.target.value);
                                }}
                                disabled={generating}
                              />
                            </VoiceFillRow>
                          </label>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className={styles.modalSection}>
                    {autoFields.length > 0 ? <h3>नागरिक / निवेदकका विवरण</h3> : null}
                    {citizenFields.length === 0 ? (
                      <p className={styles.muted}>
                        यस टेम्प्लेटमा वडा कार्यालयका विवरणबाहेक थप फिल्ड छैनन्।
                      </p>
                    ) : (
                      <div className={styles.form}>
                        {citizenFields.map((variable, index) => (
                          <label
                            key={variable.key}
                            className={`${styles.field} ${
                              activeFieldKey === variable.key ? styles.fieldActive : ""
                            }`}
                          >
                            <span className={styles.fieldLabelRow}>
                              <span className={styles.fieldIndex}>{index + 1}.</span>
                              <span>
                                {fieldLabel(variable)}
                                {variable.required ? " *" : ""}
                              </span>
                            </span>
                            {variable.type === "date" ? (
                              <input
                                type="date"
                                value={values[variable.key] ?? ""}
                                onFocus={() => setActiveFieldKey(variable.key)}
                                onChange={(e) => {
                                  updateFieldValue(variable.key, e.target.value);
                                }}
                                placeholder={variable.key}
                                disabled={generating}
                              />
                            ) : (
                              <VoiceFillRow
                                locale="ne"
                                disabled={generating}
                                onTranscript={(text) =>
                                  updateFieldValue(variable.key, text)
                                }
                              >
                                <input
                                  type={
                                    variable.type === "number" ? "number" : "text"
                                  }
                                  value={values[variable.key] ?? ""}
                                  onFocus={() =>
                                    setActiveFieldKey(variable.key)
                                  }
                                  onChange={(e) => {
                                    updateFieldValue(
                                      variable.key,
                                      e.target.value
                                    );
                                  }}
                                  placeholder={variable.key}
                                  disabled={generating}
                                />
                              </VoiceFillRow>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </aside>

              <section className={styles.previewPane}>
                <div className={styles.paneHeader}>
                  <h3>
                    {hasGenerated
                      ? "जेनेरेट गरिएको कागजात"
                      : "टेम्प्लेट पूर्वावलोकन"}
                  </h3>
                  {hasGenerated ? (
                    <p className={styles.previewEditHint}>
                      Click in the preview to edit (remove spaces, fix text) before download.
                    </p>
                  ) : null}
                </div>
                {previewHtml || hasGenerated ? (
                  <div
                    ref={previewDocRef}
                    className={`${styles.previewDoc} ${
                      hasGenerated ? styles.previewDocEditable : ""
                    }`}
                    contentEditable={hasGenerated && !generating}
                    suppressContentEditableWarning
                    onInput={() => {
                      if (hasGenerated) setPreviewEdited(true);
                    }}
                    {...(hasGenerated
                      ? {}
                      : { dangerouslySetInnerHTML: { __html: previewHtml } })}
                  />
                ) : (
                  <p className={styles.muted}>
                    {busy || generating
                      ? generating
                        ? "कागजात बनाइँदैछ…"
                        : "पूर्वावलोकन बनाइँदैछ…"
                      : "Preview will appear here after the template loads."}
                  </p>
                )}
              </section>
            </div>

            <footer ref={footerRef} className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              {!hasGenerated ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void handleGenerate()}
                  disabled={busy || generating || quotaExhausted}
                >
                  {generating
                    ? "जेनेरेट हुँदैछ…"
                    : quotaExhausted
                      ? "Generation limit reached"
                      : "Generate"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => void handleGenerate()}
                    disabled={busy || generating || downloading || quotaExhausted}
                  >
                    {generating ? (
                      "Regenerating…"
                    ) : (
                      <span className={styles.btnWithIcon}>
                        <RegenerateIcon />
                        Regenerate
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleDownloadGenerated()}
                    disabled={busy || generating || downloading}
                  >
                    {downloading
                      ? "Downloading…"
                      : `Download${generatedFileName ? ` (${generatedFileName})` : ""}${
                          previewEdited ? " · edited" : ""
                        }`}
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
          onClose={() => setMissingRequired(null)}
          onContinue={() => void handleGenerate({ allowIncomplete: true })}
        />
      ) : null}
    </div>
  );
}
