"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCaseDetail,
  fetchCaseParticipants,
  fetchSkTemplateFields,
  generateSkCaseDocument,
  isFirmQuotaError,
  previewSkCaseDocument,
  saveSkCaseDocument,
  skDocxFromEditedHtml,
  type CaseParticipantRecord,
  type CaseUploadedDocumentRecord,
  type LegalCaseRecord,
  type SkPublishedDocumentTemplate,
  type SkTemplateFormField,
} from "@/lib/sajilokanun-access";
import {
  normalizeExtractedCaseDocument,
  type ExtractedCaseDocument,
} from "@/lib/sajilokanun/document-prompts";
import { mapExtractionToSkValues } from "@/lib/sajilokanun/map-extraction-to-sk-values";
import {
  allOcrPartyIds,
  ocrOpponentPartyId,
  ocrPartyId,
  opposingParties,
  representedParties,
} from "@/lib/sajilokanun/party-fill";
import {
  applyInlineAlignmentStyles,
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
import {
  insertTextAtContentEditableCaret,
  speechTranscriptDelta,
  VoiceFillButton,
  VoiceFillRow,
} from "@/components/VoiceFillButton";
import {
  fieldKeyForRow,
  initialTableRowCounts,
  layoutFormFields,
  layoutHasRepeatableRows,
  labelWithoutRowNumber,
  MAX_TABLE_ROWS,
  rowGroupTitle,
  tableGroupTitle,
  withTableRowRequestValues,
} from "@/lib/form-row-groups";
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

const PREVIEW_FORMAT_ACTIONS: Array<{
  command: string;
  label: string;
  titleEn: string;
  titleNe: string;
}> = [
  { command: "bold", label: "B", titleEn: "Bold", titleNe: "बाक्लो" },
  { command: "italic", label: "I", titleEn: "Italic", titleNe: "छड्के" },
  { command: "underline", label: "U", titleEn: "Underline", titleNe: "रेखाङ्कन" },
  { command: "justifyLeft", label: "⟸", titleEn: "Align left", titleNe: "बायाँ पङ्क्तिबद्ध" },
  { command: "justifyCenter", label: "⇔", titleEn: "Align center", titleNe: "केन्द्र" },
  { command: "justifyRight", label: "⟹", titleEn: "Align right", titleNe: "दायाँ पङ्क्तिबद्ध" },
  { command: "justifyFull", label: "☰", titleEn: "Justify", titleNe: "दुवैतिर बराबर" },
];

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function normalizePreviewHtmlForDocx(html: string): string {
  const withParagraphs = html
    .replace(/<div\b/gi, "<p")
    .replace(/<\/div>/gi, "</p>");
  return applyInlineAlignmentStyles(withParagraphs);
}

/** Drop Latin glosses like `मिति (Miti)` or UI concat `नाम (Name)`. */
function stripLatinParenthetical(label: string): string {
  return label
    .replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function fieldLabel(field: SkTemplateFormField): string {
  const fromKey = field.key.replace(/_/g, " ");
  let ne = field.label.ne?.trim() || "";
  if (/विपक्षी/.test(field.key) && /निवेदक/.test(ne) && !/विपक्षी/.test(ne)) {
    ne = fromKey;
  }
  const primary = stripLatinParenthetical(ne || field.label.en?.trim() || field.key);
  return primary || field.key;
}

function fillStatusBanner(
  locale: "en" | "ne",
  mapped: {
    filledCount: number;
    applicantSide: "वादी" | "प्रतिवादी";
    partyMode: "single" | "samet";
    applicantNames: string[];
  }
): string {
  const sideNe = mapped.applicantSide;
  const sideEn =
    mapped.applicantSide === "प्रतिवादी"
      ? "Defendant (Pratibadi)"
      : "Plaintiff (Badi)";
  const names = mapped.applicantNames.join(", ");
  if (locale === "ne") {
    return `मुद्दाको पक्ष: ${sideNe}${names ? ` — ${names}` : ""}. OCR बाट ${mapped.filledCount} फिल्ड भरियो; नभएका फिल्ड खाली राखियो।`;
  }
  return `Case side: ${sideEn}${names ? ` — ${names}` : ""}. Mapped ${mapped.filledCount} OCR fields; missing placeholders left blank.`;
}

function sectionTitle(section: string): string {
  if (!section) return "";
  if (section.startsWith("plaintiff") || section.startsWith("petitioner")) {
    return "वादी / निवेदक";
  }
  if (section === "other_party") {
    return "अन्य पक्ष / वारिस हुनेको";
  }
  if (section.startsWith("defendant") || section.startsWith("respondent")) {
    return "प्रतिवादी / विपक्षी";
  }
  if (section === "court") return "अदालत";
  if (section === "case") return "मुद्दा";
  if (section === "facts") return "तथ्य";
  if (section === "claims") return "दाबी";
  if (section === "evidence") return "प्रमाण";
  if (section === "other") return "अन्य";
  if (section.startsWith("table:") || section.startsWith("table-row:")) {
    return "";
  }
  return stripLatinParenthetical(section);
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
  const [tableRowCounts, setTableRowCounts] = useState<Record<string, number>>(
    {}
  );
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [autofillBanner, setAutofillBanner] = useState("");
  const [caseVitals, setCaseVitals] = useState<ExtractedCaseDocument | null>(null);
  const [participants, setParticipants] = useState<CaseParticipantRecord[]>([]);
  const [casePartySide, setCasePartySide] = useState<
    LegalCaseRecord["partySide"] | null
  >(null);
  const [caseNo, setCaseNo] = useState("");
  const [selectedPartyIds, setSelectedPartyIds] = useState<string[]>([]);
  const [applicantSide, setApplicantSide] = useState<"वादी" | "प्रतिवादी">("वादी");
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFileName, setGeneratedFileName] = useState("");
  const [previewEditorSeed, setPreviewEditorSeed] = useState(0);
  const [previewEdited, setPreviewEdited] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [missingRequired, setMissingRequired] = useState<string[] | null>(null);
  const [pendingIncompleteAction, setPendingIncompleteAction] = useState<
    "generate" | "save" | null
  >(null);
  const previewDocRef = useRef<HTMLDivElement | null>(null);
  const previewVoiceSessionTextRef = useRef("");
  const formScrollRef = useRef<HTMLDivElement | null>(null);
  const fieldNavSourceRef = useRef<"form" | "preview">("form");
  const ignoreNextFormFocusRef = useRef(false);
  const valuesRef = useRef(values);
  const generatedBlobRef = useRef(generatedBlob);
  const templatePreviewHtmlRef = useRef("");
  const fieldLabelByKeyRef = useRef<Map<string, string>>(new Map());

  valuesRef.current = values;
  generatedBlobRef.current = generatedBlob;

  const title =
    locale === "ne"
      ? template.name.ne || template.name.en
      : template.name.en || template.name.ne;

  const hasGenerated = Boolean(generatedBlob);

  const orderedFields = useMemo(
    () => orderFieldsByTemplate(userFields, placeholderKeys),
    [userFields, placeholderKeys]
  );

  const formLayout = useMemo(
    () => layoutFormFields(orderedFields),
    [orderedFields]
  );
  const hasRepeatableRows = layoutHasRepeatableRows(formLayout);
  const repeatableGroupCount = formLayout.filter(
    (group) => group.type === "repeatable"
  ).length;

  function rowCountForGroup(tableGroup: string): number {
    return tableRowCounts[tableGroup] ?? 1;
  }

  const ownSideParties = useMemo(() => {
    if (!caseVitals) return [];
    return representedParties(caseVitals, casePartySide);
  }, [caseVitals, casePartySide]);
  const opponentParties = useMemo(() => {
    if (!caseVitals) return [];
    return opposingParties(caseVitals, casePartySide);
  }, [caseVitals, casePartySide]);
  // Always offer निवेदक selection when anyone is available (including a single
  // party, and opponents who can be chosen as निवेदक on this form).
  const showPartyPicker = ownSideParties.length + opponentParties.length >= 1;

  useEffect(() => {
    const labels = new Map<string, string>();
    for (const field of userFields) {
      labels.set(field.key, fieldLabel(field));
    }
    for (const group of formLayout) {
      if (group.type !== "repeatable") continue;
      const rowCount = tableRowCounts[group.tableGroup] ?? 1;
      for (let row = 1; row <= rowCount; row += 1) {
        for (const column of group.columns) {
          labels.set(
            fieldKeyForRow(column.key, row),
            labelWithoutRowNumber(fieldLabel(column), row)
          );
        }
      }
    }
    fieldLabelByKeyRef.current = labels;
  }, [userFields, formLayout, tableRowCounts]);

  function previewDisplayForKey(key: string, value: string): string {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
    return fieldLabelByKeyRef.current.get(key) || key;
  }

  function paintedPreviewHtml(
    baseHtml: string,
    nextValues: Record<string, string>
  ): string {
    return applyValuesToSkPreviewHtml(
      baseHtml,
      withTableRowRequestValues(nextValues, tableRowCounts, hasRepeatableRows),
      previewDisplayForKey
    );
  }

  function paintLivePreview(nextValues: Record<string, string>) {
    const base = templatePreviewHtmlRef.current;
    if (base && !generatedBlobRef.current && skPreviewHtmlHasFieldMarks(base)) {
      const pane = previewDocRef.current;
      const top = pane?.scrollTop ?? 0;
      setPreviewHtml(paintedPreviewHtml(base, nextValues));
      requestAnimationFrame(() => {
        if (previewDocRef.current) previewDocRef.current.scrollTop = top;
      });
    }
  }

  function commitValues(next: Record<string, string>) {
    valuesRef.current = next;
    setValues(next);
    paintLivePreview(next);
  }

  function remapFromOcr(
    extracted: ExtractedCaseDocument,
    fields: SkTemplateFormField[],
    nextSelectedPartyIds: string[],
    nextParticipants: CaseParticipantRecord[] = participants,
    nextPartySide: LegalCaseRecord["partySide"] | null = casePartySide
  ) {
    const mapped = mapExtractionToSkValues(extracted, fields, {
      selectedPartyIds: nextSelectedPartyIds,
      casePartySide: nextPartySide,
      participants: nextParticipants,
      caseNo,
    });
    setApplicantSide(mapped.applicantSide);
    setTableRowCounts(
      initialTableRowCounts(layoutFormFields(fields), mapped.suggestedRowCount)
    );
    const next = { ...valuesRef.current };
    for (const field of fields) {
      next[field.key] = mapped.values[field.key] ?? "";
    }
    for (const [key, value] of Object.entries(mapped.values)) {
      next[key] = value;
    }
    commitValues(next);
    setAutofillBanner(fillStatusBanner(locale, mapped));
    return mapped;
  }

  function missingRequiredLabels(): string[] {
    const fields: Array<{ key: string; required?: boolean; label: string }> = [];
    for (const group of formLayout) {
      if (group.type === "loose") {
        if (
          /^blank_\d+$/i.test(group.field.key) ||
          /^unknown_\d+$/i.test(group.field.key)
        ) {
          continue;
        }
        fields.push({
          key: group.field.key,
          required: group.field.required,
          label: fieldLabel(group.field),
        });
        continue;
      }
      if (group.type === "fixed-row") {
        for (const field of group.fields) {
          fields.push({
            key: field.key,
            required: field.required,
            label: fieldLabel(field),
          });
        }
        continue;
      }
      const rowCount = rowCountForGroup(group.tableGroup);
      for (let row = 1; row <= rowCount; row += 1) {
        for (const column of group.columns) {
          fields.push({
            key: fieldKeyForRow(column.key, row),
            required: Boolean(column.required) && row === 1,
            label: `${labelWithoutRowNumber(fieldLabel(column), row)} (${rowGroupTitle(row, locale)})`,
          });
        }
      }
    }
    return listMissingRequiredLabels(fields, values);
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
        generatedBlobRef.current = null;
        setPreviewEdited(false);
        templatePreviewHtmlRef.current = "";
      try {
        const [fields, detail, people] = await Promise.all([
          fetchSkTemplateFields(template.id),
          fetchCaseDetail(caseId).catch(() => null),
          fetchCaseParticipants(caseId).catch(() => [] as CaseParticipantRecord[]),
        ]);
        if (cancelled) return;
        setUserFields(fields.userFields);
        setPlaceholderKeys(fields.placeholderKeys);
        setTableRowCounts({});
        setParticipants(people);
        setCasePartySide(detail?.partySide ?? null);
        setCaseNo(detail?.caseNo?.trim() || "");
        setApplicantSide(
          detail?.partySide === "defendant" ? "प्रतिवादी" : "वादी"
        );
        setSelectedPartyIds([]);

        const initial: Record<string, string> = {};
        for (const field of fields.userFields) {
          initial[field.key] = "";
        }

        const rawFacts = detail?.documentExtraction?.facts;
        const extracted =
          rawFacts && typeof rawFacts === "object"
            ? normalizeExtractedCaseDocument(rawFacts)
            : null;
        if (extracted) {
          setCaseVitals(extracted);
        }
        const ownParties = extracted
          ? representedParties(extracted, detail?.partySide ?? null)
          : [];
        const initialPartyIds = allOcrPartyIds(ownParties.length);
        setSelectedPartyIds(initialPartyIds);
        const mapped = mapExtractionToSkValues(extracted, fields.userFields, {
          selectedPartyIds: initialPartyIds,
          casePartySide: detail?.partySide ?? null,
          participants: people,
          caseNo: detail?.caseNo?.trim() || "",
        });
        setApplicantSide(mapped.applicantSide);
        setTableRowCounts(
          initialTableRowCounts(
            layoutFormFields(fields.userFields),
            mapped.suggestedRowCount
          )
        );
        for (const [key, value] of Object.entries(mapped.values)) {
          initial[key] = value;
        }
        setAutofillBanner(fillStatusBanner(locale, mapped));

        valuesRef.current = initial;
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

  const loadTemplatePreview = useCallback(async () => {
    if (generatedBlobRef.current) return;
    setBusy(true);
    setError("");
    try {
      const { blob } = await previewSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: withTableRowRequestValues(
          valuesRef.current,
          tableRowCounts,
          hasRepeatableRows
        ),
      });
      if (generatedBlobRef.current) return;
      const html = await docxToPreviewHtml(blob);
      templatePreviewHtmlRef.current = html;
      if (!skPreviewHtmlHasFieldMarks(html)) {
        setPreviewHtml(html);
      } else {
        setPreviewHtml(paintedPreviewHtml(html, valuesRef.current));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview document");
    } finally {
      setBusy(false);
    }
  }, [caseId, template.id, tableRowCounts, hasRepeatableRows]);

  useEffect(() => {
    if (fieldsLoading || userFields.length === 0) return;
    void loadTemplatePreview();
  }, [fieldsLoading, template.id, caseId, tableRowCounts, loadTemplatePreview]);

  function scrollFormFieldIntoView(fieldKey: string): boolean {
    const formRoot = formScrollRef.current;
    if (!formRoot) return false;
    const field = formRoot.querySelector(
      `[data-sk-form-field="${CSS.escape(fieldKey)}"]`
    );
    if (!(field instanceof HTMLElement)) return false;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = field.querySelector("input, textarea, select");
    if (input instanceof HTMLElement) {
      input.focus({ preventScroll: true });
    }
    return true;
  }

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
    if (fieldNavSourceRef.current !== "form") return;
    const container = previewDocRef.current;
    if (!container) return;
    const target = container.querySelector(
      `[data-sk-field="${CSS.escape(activeFieldKey)}"]`
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFieldKey, generatedBlob]);

  function handleFieldFocus(fieldKey: string) {
    if (ignoreNextFormFocusRef.current) {
      ignoreNextFormFocusRef.current = false;
      setActiveFieldKey(fieldKey);
      return;
    }
    fieldNavSourceRef.current = "form";
    setActiveFieldKey(fieldKey);
  }

  function handlePreviewFieldActivate(fieldKey: string) {
    fieldNavSourceRef.current = "preview";
    setActiveFieldKey(fieldKey);
    ignoreNextFormFocusRef.current = scrollFormFieldIntoView(fieldKey);
  }

  function previewFieldKeyFromEvent(event: { target: EventTarget | null }): string | null {
    const node = event.target;
    if (!(node instanceof Element)) return null;
    const mark = node.closest("[data-sk-field]");
    if (!mark || !previewDocRef.current?.contains(mark)) return null;
    return mark.getAttribute("data-sk-field");
  }

  function restoreTemplatePreview() {
    const base = templatePreviewHtmlRef.current;
    if (base) {
      setPreviewHtml(paintedPreviewHtml(base, valuesRef.current));
      return;
    }
    void loadTemplatePreview();
  }

  useEffect(() => {
    if (!hasGenerated || !previewDocRef.current) return;
    previewDocRef.current.innerHTML = previewHtml;
    setPreviewEdited(false);
  }, [hasGenerated, previewEditorSeed, previewHtml]);

  function applyPreviewFormat(command: string) {
    if (!hasGenerated || generating) return;
    previewDocRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false);
    setPreviewEdited(true);
  }

  function insertPreviewVoiceTranscript(sessionText: string) {
    const root = previewDocRef.current;
    if (!root || !hasGenerated || generating) return;
    const { delta, nextBaseline } = speechTranscriptDelta(
      previewVoiceSessionTextRef.current,
      sessionText
    );
    previewVoiceSessionTextRef.current = nextBaseline;
    if (!delta) return;
    if (insertTextAtContentEditableCaret(root, delta)) {
      setPreviewEdited(true);
    }
  }

  function invalidateGenerated() {
    if (generatedBlobRef.current) {
      setGeneratedBlob(null);
      setGeneratedFileName("");
      generatedBlobRef.current = null;
      setPreviewEdited(false);
      setAutofillBanner(
        locale === "ne"
          ? "फिल्ड परिवर्तन भयो — फेरि Generate गर्नुहोस्। पूर्वावलोकनका सम्पादन हट्छन्।"
          : "Fields changed — Generate again. Preview edits will be discarded."
      );
      restoreTemplatePreview();
    }
  }

  function updateFieldValue(key: string, value: string) {
    invalidateGenerated();
    const next = { ...valuesRef.current, [key]: value };
    commitValues(next);
  }

  function addTableRow(tableGroup: string) {
    const current = rowCountForGroup(tableGroup);
    if (current >= MAX_TABLE_ROWS) return;
    invalidateGenerated();
    setTableRowCounts((prev) => ({ ...prev, [tableGroup]: current + 1 }));
  }

  function removeTableRow(tableGroup: string, row: number) {
    const current = rowCountForGroup(tableGroup);
    if (current <= 1) return;
    const columns = formLayout.flatMap((group) =>
      group.type === "repeatable" && group.tableGroup === tableGroup
        ? group.columns
        : []
    );
    const next = { ...valuesRef.current };
    for (let from = row; from < current; from += 1) {
      for (const column of columns) {
        next[fieldKeyForRow(column.key, from)] =
          next[fieldKeyForRow(column.key, from + 1)] ?? "";
      }
    }
    for (const column of columns) {
      delete next[fieldKeyForRow(column.key, current)];
    }
    valuesRef.current = next;
    setValues(next);
    invalidateGenerated();
    setTableRowCounts((prev) => ({ ...prev, [tableGroup]: current - 1 }));
  }

  async function handleGenerate(options?: { allowIncomplete?: boolean }) {
    if (!confirmOrRun("generate", Boolean(options?.allowIncomplete))) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: withTableRowRequestValues(
          values,
          tableRowCounts,
          hasRepeatableRows
        ),
        allowIncomplete: options?.allowIncomplete === true,
      });
      setGeneratedBlob(result.blob);
      generatedBlobRef.current = result.blob;
      setGeneratedFileName(result.fileName);
      setPreviewHtml(await docxToEditableHtml(result.blob));
      setPreviewEditorSeed((seed) => seed + 1);
      setPreviewEdited(false);
      setAutofillBanner(
        locale === "ne"
          ? "कागजात तयार भयो — दायाँ पूर्वावलोकनमा सिधै सम्पादन गर्न सकिन्छ (पाठ थप्ने/हटाउने, ढाँचा मिलाउने), त्यसपछि डाउनलोड वा सेभ गर्नुहोस्।"
          : "Document is ready — edit the preview on the right (add/remove text, adjust formatting), then download or save."
      );
    } catch (err) {
      if (isFirmQuotaError(err) && err.code === "firm_documents_quota") {
        onQuotaError?.({ code: err.code, used: err.used, limit: err.limit });
      }
      setError(
        err instanceof Error ? err.message : "Failed to generate document"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function resolveOutputDocument(): Promise<{ blob: Blob; fileName: string }> {
    const fileName = generatedFileName || "document.docx";
    // Prefer the live preview DOM when the user changed it — that is the
    // version that should land in case Documents / download.
    const liveHtml = previewDocRef.current?.innerHTML?.trim() ?? "";
    if (previewEdited && liveHtml) {
      const converted = await skDocxFromEditedHtml({
        caseId,
        html: normalizePreviewHtmlForDocx(liveHtml),
        fileName,
      });
      setGeneratedBlob(converted.blob);
      generatedBlobRef.current = converted.blob;
      setGeneratedFileName(converted.fileName);
      setPreviewEdited(false);
      return converted;
    }
    if (!generatedBlobRef.current && !generatedBlob) {
      throw new Error(
        locale === "ne"
          ? "पहिले कागजात Generate गर्नुहोस्।"
          : "Generate the document first."
      );
    }
    return {
      blob: generatedBlobRef.current ?? generatedBlob!,
      fileName,
    };
  }

  async function handleDownloadGenerated() {
    setDownloading(true);
    setError("");
    try {
      const { blob, fileName } = await resolveOutputDocument();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download document"
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveGenerated(options?: { allowIncomplete?: boolean }) {
    if (!generatedBlob && !previewDocRef.current) return;
    if (!confirmOrRun("save", Boolean(options?.allowIncomplete))) return;
    setBusy(true);
    setError("");
    try {
      const { blob, fileName } = await resolveOutputDocument();
      const contentBase64 = await blobToBase64(blob);
      const { upload } = await saveSkCaseDocument({
        caseId,
        templateId: template.id,
        variables: withTableRowRequestValues(
          values,
          tableRowCounts,
          hasRepeatableRows
        ),
        allowIncomplete: options?.allowIncomplete === true,
        contentBase64,
        fileName,
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
    remapFromOcr(caseVitals, userFields, selectedPartyIds);
    invalidateGenerated();
  }

  function applyPartyIds(nextIds: string[]) {
    setSelectedPartyIds(nextIds);
    if (caseVitals) {
      remapFromOcr(caseVitals, userFields, nextIds);
    }
    invalidateGenerated();
  }

  function togglePartyId(id: string) {
    const selected = new Set(selectedPartyIds);
    const isOpponent = /^ocr:opp:/i.test(id);
    if (selected.has(id)) {
      if (selected.size <= 1) return;
      selected.delete(id);
    } else {
      for (const existing of [...selected]) {
        const existingOpp = /^ocr:opp:/i.test(existing);
        if (existingOpp !== isOpponent) selected.delete(existing);
      }
      selected.add(id);
    }
    applyPartyIds(Array.from(selected));
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

  function renderFormField(
    field: SkTemplateFormField,
    index: number,
    row?: number
  ) {
    const section = field.section?.trim() || "";
    const sectionLabel = sectionTitle(section);
    const label =
      row != null
        ? labelWithoutRowNumber(fieldLabel(field), row)
        : fieldLabel(field);
    return (
      <label
        key={field.key}
        data-sk-form-field={field.key}
        className={`${styles.field} ${
          activeFieldKey === field.key ? styles.fieldActive : ""
        }`}
      >
        <span className={styles.fieldLabelRow}>
          <span className={styles.fieldIndex}>{index}.</span>
          <span>
            {label}
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
              updateFieldValue(field.key, e.target.value);
            }}
            placeholder={field.key}
            disabled={busy || generating || hasGenerated}
          />
        ) : (
          <VoiceFillRow
            locale={locale}
            lang="ne-NP"
            disabled={busy || generating || hasGenerated}
            onTranscript={(text) => {
              updateFieldValue(field.key, text);
            }}
          >
            <input
              type={field.type === "number" ? "number" : "text"}
              value={values[field.key] ?? ""}
              onFocus={() => handleFieldFocus(field.key)}
              onChange={(e) => {
                updateFieldValue(field.key, e.target.value);
              }}
              placeholder={field.key}
              disabled={busy || generating || hasGenerated}
            />
          </VoiceFillRow>
        )}
      </label>
    );
  }

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
                ? "बायाँ: फिल्ड भर्नुहोस् · दायाँ पूर्वावलोकन तुरुन्तै अपडेट हुन्छ · Generate: OCR/फारमका मान मात्र भर्छ (खाली फिल्ड अनुमान गर्दैन)"
                : "Left: fill fields · Right preview updates live · Generate: fills from OCR/form only (does not invent missing values)"}
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

        {casePartySide || caseVitals ? (
          <div className={styles.partyBar}>
            <div className={styles.partyBarRow}>
              <span
                className={`${styles.sideBadge} ${
                  applicantSide === "प्रतिवादी" ? styles.sideBadgeDefendant : ""
                }`}
              >
                {locale === "ne"
                  ? casePartySide === "defendant"
                    ? "मुद्दाको पक्ष: प्रतिवादी"
                    : "मुद्दाको पक्ष: वादी"
                  : casePartySide === "defendant"
                    ? "Case side: Defendant (Pratibadi)"
                    : "Case side: Plaintiff (Badi)"}
              </span>
              {showPartyPicker ? (
                <div className={styles.partyChecks}>
                  <div className={styles.partyChecksHeader}>
                    <span>
                      {locale === "ne"
                        ? "निवेदक छान्नुहोस् (यस निवेदनमा)"
                        : "Select applicant (निवेदक) for this form"}
                    </span>
                    <button
                      type="button"
                      className={styles.partySelectAll}
                      disabled={busy || generating || fieldsLoading || hasGenerated}
                      onClick={() =>
                        applyPartyIds(allOcrPartyIds(ownSideParties.length))
                      }
                    >
                      {locale === "ne" ? "आफ्नो पक्ष" : "Own side"}
                    </button>
                  </div>
                  {ownSideParties.length > 0 ? (
                    <div className={styles.partyCheckList}>
                      <span className={styles.partyGroupLabel}>
                        {locale === "ne"
                          ? casePartySide === "defendant"
                            ? "प्रतिवादी"
                            : "वादी"
                          : casePartySide === "defendant"
                            ? "Defendants"
                            : "Plaintiffs"}
                      </span>
                      {ownSideParties.map((party, index) => {
                        const id = ocrPartyId(index);
                        const name = party.पूरा_नाम?.trim() || `${index + 1}`;
                        return (
                          <label key={id} className={styles.partyCheck}>
                            <input
                              type="checkbox"
                              checked={selectedPartyIds.includes(id)}
                              disabled={busy || generating || fieldsLoading || hasGenerated}
                              onChange={() => togglePartyId(id)}
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                  {opponentParties.length > 0 ? (
                    <div className={styles.partyCheckList}>
                      <span className={styles.partyGroupLabel}>
                        {locale === "ne"
                          ? casePartySide === "defendant"
                            ? "वादी / विपक्षी"
                            : "प्रतिवादी / विपक्षी"
                          : casePartySide === "defendant"
                            ? "Plaintiffs"
                            : "Defendants"}
                      </span>
                      {opponentParties.map((party, index) => {
                        const id = ocrOpponentPartyId(index);
                        const name = party.पूरा_नाम?.trim() || `${index + 1}`;
                        return (
                          <label key={id} className={styles.partyCheck}>
                            <input
                              type="checkbox"
                              checked={selectedPartyIds.includes(id)}
                              disabled={busy || generating || fieldsLoading || hasGenerated}
                              onChange={() => togglePartyId(id)}
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
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
                      disabled={busy || generating || hasGenerated}
                    >
                      {locale === "ne" ? "OCR फेरि लागू" : "Re-apply OCR"}
                    </button>
                  ) : null}
                </div>
                {hasGenerated ? (
                  <p className={styles.previewEditHint}>
                    {locale === "ne"
                      ? "फिल्ड परिवर्तन गर्न फेरि Generate गर्नुहोस्।"
                      : "Regenerate to change fields."}
                  </p>
                ) : null}
                {userFields.length === 0 ? (
                  <p className={styles.muted}>
                    This template has no fillable placeholders.
                  </p>
                ) : (
                  <div className={styles.formScroll} ref={formScrollRef}>
                    <div className={styles.form}>
                      {(() => {
                        let fieldNumber = 1;
                        return formLayout.flatMap((group) => {
                          if (group.type === "loose") {
                            const index = fieldNumber;
                            fieldNumber += 1;
                            return [renderFormField(group.field, index)];
                          }
                          if (group.type === "fixed-row") {
                            return [
                              <div
                                key={`fixed-${group.tableGroup}-${group.title}`}
                                className={styles.rowBlock}
                              >
                                <div className={styles.rowBlockHeader}>
                                  <p className={styles.rowBlockTitle}>
                                    {group.title}
                                  </p>
                                </div>
                                <div className={styles.rowBlockFields}>
                                  {group.fields.map((field) => {
                                    const index = fieldNumber;
                                    fieldNumber += 1;
                                    return renderFormField(field, index);
                                  })}
                                </div>
                              </div>,
                            ];
                          }
                          const rowCount = rowCountForGroup(group.tableGroup);
                          const blocks = [];
                          if (repeatableGroupCount > 1) {
                            blocks.push(
                              <p
                                key={`table-title-${group.tableGroup}`}
                                className={styles.tableGroupTitle}
                              >
                                {tableGroupTitle(group.tableGroup, locale)}
                              </p>
                            );
                          }
                          for (let row = 1; row <= rowCount; row += 1) {
                            const rowIndex = row;
                            blocks.push(
                              <div
                                key={`row-${group.tableGroup}-${rowIndex}-${group.columns[0].key}`}
                                className={styles.rowBlock}
                              >
                                <div className={styles.rowBlockHeader}>
                                  <p className={styles.rowBlockTitle}>
                                    {rowGroupTitle(rowIndex, locale)}
                                  </p>
                                  {rowCount > 1 ? (
                                    <button
                                      type="button"
                                      className={styles.rowBlockRemove}
                                      onClick={() =>
                                        removeTableRow(group.tableGroup, rowIndex)
                                      }
                                      disabled={busy || generating || hasGenerated}
                                    >
                                      {locale === "ne" ? "हटाउनुहोस्" : "Remove"}
                                    </button>
                                  ) : null}
                                </div>
                                <div className={styles.rowBlockFields}>
                                  {group.columns.map((column) => {
                                    const index = fieldNumber;
                                    fieldNumber += 1;
                                    return renderFormField(
                                      {
                                        ...column,
                                        key: fieldKeyForRow(column.key, rowIndex),
                                        required:
                                          Boolean(column.required) &&
                                          rowIndex === 1,
                                      },
                                      index,
                                      rowIndex
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          blocks.push(
                            <button
                              key={`add-row-${group.tableGroup}-${group.columns[0].key}`}
                              type="button"
                              className={styles.rowAddBtn}
                              onClick={() => addTableRow(group.tableGroup)}
                              disabled={
                                busy ||
                                generating ||
                                hasGenerated ||
                                rowCount >= MAX_TABLE_ROWS
                              }
                            >
                              {locale === "ne"
                                ? "+ क्रम थप्नुहोस्"
                                : "+ Add row"}
                            </button>
                          );
                          return blocks;
                        });
                      })()}
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
                </div>
                {hasGenerated ? (
                  <>
                    <p className={styles.previewEditHint}>
                      {locale === "ne"
                        ? "पूर्वावलोकनमा क्लिक गरेर पाठ थप्न/हटाउन र ढाँचा मिलाउन सकिन्छ। माइकबाट कर्सर भएको ठाउँमा बोलेर लेख्न सकिन्छ। डाउनलोड र सेभले सम्पादित प्रति सेभ गर्छ।"
                        : "Click in the preview to add, remove, or reformat text. Use the mic to dictate at the cursor. Download and Save use your edits."}
                    </p>
                    <div className={styles.formatBar} role="toolbar" aria-label="Formatting">
                      {PREVIEW_FORMAT_ACTIONS.map((action) => (
                        <button
                          key={action.command}
                          type="button"
                          className={styles.formatBtn}
                          title={locale === "ne" ? action.titleNe : action.titleEn}
                          disabled={generating}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyPreviewFormat(action.command)}
                        >
                          {action.label}
                        </button>
                      ))}
                      <VoiceFillButton
                        locale={locale}
                        lang="ne-NP"
                        interimResults={false}
                        disabled={generating}
                        className={styles.formatVoiceBtn}
                        onSessionStart={() => {
                          previewVoiceSessionTextRef.current = "";
                          previewDocRef.current?.focus();
                        }}
                        onTranscript={insertPreviewVoiceTranscript}
                      />
                    </div>
                  </>
                ) : null}
                {previewHtml || hasGenerated ? (
                  <div
                    key={hasGenerated ? "generated" : "template"}
                    ref={previewDocRef}
                    className={`${styles.previewDoc} ${
                      hasGenerated ? styles.previewDocEditable : ""
                    }`}
                    contentEditable={hasGenerated && !generating}
                    suppressContentEditableWarning
                    onInput={() => {
                      if (hasGenerated) setPreviewEdited(true);
                    }}
                    onClick={(event) => {
                      if (hasGenerated) return;
                      const fieldKey = previewFieldKeyFromEvent(event);
                      if (!fieldKey) return;
                      handlePreviewFieldActivate(fieldKey);
                    }}
                    {...(hasGenerated
                      ? {}
                      : { dangerouslySetInnerHTML: { __html: previewHtml } })}
                  />
                ) : (
                  <p className={styles.muted}>
                    {busy || generating
                      ? generating
                        ? locale === "ne"
                          ? "कागजात बनाइँदैछ…"
                          : "Generating the document…"
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
                    disabled={busy || generating || downloading}
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
                    onClick={() => void handleDownloadGenerated()}
                    disabled={busy || generating || downloading}
                  >
                    {downloading
                      ? locale === "ne"
                        ? "डाउनलोड हुँदैछ…"
                        : "Downloading…"
                      : locale === "ne"
                        ? `डाउनलोड${previewEdited ? " · सम्पादित" : ""}`
                        : `Download${previewEdited ? " · edited" : ""}`}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleSaveGenerated()}
                    disabled={busy || generating || downloading}
                  >
                    {busy
                      ? locale === "ne"
                        ? "सेभ हुँदैछ…"
                        : "Saving…"
                      : locale === "ne"
                        ? `केस कागजातमा सेभ${previewEdited ? " · सम्पादित" : ""}`
                        : `Save to case Documents${previewEdited ? " · edited" : ""}`}
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

