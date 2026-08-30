"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import mammoth from "mammoth";
import {
  wardFetchMe,
  wardFetchTemplateFields,
  wardGenerateDocument,
  wardLocalizeVariables,
  wardPreviewDocument,
  type WardDocumentTemplate,
  type WardOperatorProfile,
  type WardTemplateVariable,
} from "@/lib/ward-access";
import {
  buildInitialWardDocumentValues,
  WARD_AUTO_FIELD_META,
} from "@/lib/ward-profile-variables";
import { wardBilingualFieldLabel } from "@/lib/ward-field-labels-ne";
import styles from "@/app/ward/ward.module.css";

type FlowStep = "fill" | "preview";

type WardDocumentModalProps = {
  template: WardDocumentTemplate;
  profile: WardOperatorProfile;
  quotaExhausted: boolean;
  onClose: () => void;
  onDownloaded: (profile: WardOperatorProfile) => void;
};

function fieldLabel(variable: WardTemplateVariable): string {
  return wardBilingualFieldLabel(variable.key, variable.label.ne, variable.label.en);
}

export function WardDocumentModal({
  template,
  profile,
  quotaExhausted,
  onClose,
  onDownloaded,
}: WardDocumentModalProps) {
  const [step, setStep] = useState<FlowStep>("fill");
  const [userFields, setUserFields] = useState<WardTemplateVariable[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadFields() {
      setFieldsLoading(true);
      setError("");
      try {
        const fields = await wardFetchTemplateFields(template.id);
        if (cancelled) return;
        setUserFields(fields.userFields);
        setValues(buildInitialWardDocumentValues(profile, fields.userFields));
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
  }, [profile, template.id]);

  const previewFields = useMemo(() => {
    const fields = userFields.map((variable) => ({
      key: variable.key,
      label: fieldLabel(variable),
      required: variable.required,
      type: variable.type,
      auto: false,
    }));
    for (const auto of WARD_AUTO_FIELD_META) {
      fields.push({
        key: auto.key,
        label: auto.label,
        required: false,
        type: "text" as const,
        auto: true,
      });
    }
    return fields;
  }, [userFields]);

  const refreshPreview = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const localized = await wardLocalizeVariables({
        templateId: template.id,
        variables: values,
      });
      const nextValues = localized.variables;
      setValues(nextValues);

      const { blob, fileName } = await wardPreviewDocument({
        templateId: template.id,
        variables: nextValues,
        skipLocalize: true,
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
  }, [template.id, values]);

  async function handleFillSubmit(e: React.FormEvent) {
    e.preventDefault();
    await refreshPreview();
  }

  async function handleDownload() {
    if (quotaExhausted) return;
    setBusy(true);
    setError("");
    try {
      const localized = await wardLocalizeVariables({
        templateId: template.id,
        variables: values,
      });
      const nextValues = localized.variables;
      setValues(nextValues);

      const { blob, fileName } = await wardGenerateDocument({
        templateId: template.id,
        variables: nextValues,
        skipLocalize: true,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      const me = await wardFetchMe();
      onDownloaded(me.profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
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
        aria-labelledby="ward-doc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <h2 id="ward-doc-modal-title">{template.name.en}</h2>
            <p className={styles.muted}>
              {step === "fill"
                ? "वडा कार्यालयको ठेगाना र आजको नेपाली मिति स्वतः भरिन्छ। नागरिक/निवेदकका विवरण अंग्रेजीमा भर्न सकिन्छ — पूर्वावलोकनमा औपचारिक नेपालीमा रूपान्तरण हुन्छ।"
                : "कागजातको पूर्वावलोकन हेर्नुहोस्, आवश्यक भए विवरण सच्याउनुहोस्, त्यसपछि डाउनलोड गर्नुहोस्।"}
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
              <h3>वडा कार्यालयबाट स्वतः भरिएका विवरण</h3>
              <div className={styles.autoGrid}>
                {WARD_AUTO_FIELD_META.map((field) => (
                  <label key={field.key} className={styles.field}>
                    <span>{field.label}</span>
                    <input
                      type="text"
                      value={values[field.key] ?? ""}
                      readOnly
                      className={styles.readonlyInput}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.modalSection}>
              <h3>नागरिक / निवेदकका विवरण</h3>
              {userFields.length === 0 ? (
                <p className={styles.muted}>
                  यस टेम्प्लेटमा वडा कार्यालयका विवरणबाहेक थप फिल्ड छैनन्।
                </p>
              ) : (
                <div className={styles.form}>
                  {userFields.map((variable) => (
                    <label key={variable.key} className={styles.field}>
                      <span>
                        {fieldLabel(variable)}
                        {variable.required ? " *" : ""}
                      </span>
                      <input
                        type={
                          variable.type === "number"
                            ? "number"
                            : variable.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={values[variable.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [variable.key]: e.target.value,
                          }))
                        }
                        required={variable.required}
                        placeholder={fieldLabel(variable)}
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
                {busy ? "Nepali conversion & preview…" : "Preview document"}
              </button>
            </footer>
          </form>
        ) : (
          <div className={styles.modalBody}>
            <div className={styles.previewLayout}>
              <section className={styles.previewPane}>
                <h3>कागजात पूर्वावलोकन</h3>
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
                <h3>विवरण सच्याउनुहोस्</h3>
                <div className={styles.form}>
                  {previewFields.map((field) => (
                    <label key={field.key} className={styles.field}>
                      <span>
                        {field.label}
                        {field.required ? " *" : ""}
                        {field.auto ? " (स्वतः)" : ""}
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
                        readOnly={field.auto}
                        className={field.auto ? styles.readonlyInput : undefined}
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
                className={styles.primaryBtn}
                onClick={() => void handleDownload()}
                disabled={busy || quotaExhausted}
              >
                {busy
                  ? "Downloading…"
                  : quotaExhausted
                    ? "Generation limit reached"
                    : `Download${previewFileName ? ` (${previewFileName})` : ""}`}
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
