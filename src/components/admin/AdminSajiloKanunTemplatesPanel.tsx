"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  adminCreateSkTemplate,
  adminDeleteSkTemplate,
  adminFetchSkTemplateFile,
  adminFetchSkTemplateMeta,
  adminFetchSkTemplates,
  adminUpdateSkTemplate,
  readFileAsBase64,
  type SajiloKanunDocumentTemplate,
  type SkTemplateMeta,
  type SkTemplateVariable,
} from "@/lib/sajilo-kanun-templates-admin";
import { COURT_TYPE_META, type CourtType } from "@/lib/sajilokanun/court-type";
import type { LegalCaseDocumentKind } from "@/lib/sajilokanun-access";
import { AdminSajiloKanunTemplateEditor } from "./AdminSajiloKanunTemplateEditor";
import styles from "@/app/admin.module.css";

const EMPTY_VARIABLE: SkTemplateVariable = {
  key: "",
  label: { en: "", ne: "" },
  type: "text",
  required: true,
};

const DEFAULT_PAGE_SIZE = 10;

type TemplateFormState = {
  nameEn: string;
  nameNe: string;
  nameRoman: string;
  descriptionEn: string;
  descriptionNe: string;
  courtType: CourtType | "";
  documentKind: LegalCaseDocumentKind | "";
  status: "draft" | "published";
  variables: SkTemplateVariable[];
  file: File | null;
};

const EMPTY_FORM: TemplateFormState = {
  nameEn: "",
  nameNe: "",
  nameRoman: "",
  descriptionEn: "",
  descriptionNe: "",
  courtType: "",
  documentKind: "",
  status: "draft",
  variables: [],
  file: null,
};

function FormField({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.skField}>
      <label className={styles.skFieldLabel} htmlFor={htmlFor}>
        {label}
        {required ? <span className={styles.skRequiredMark}> *</span> : null}
      </label>
      {children}
      {hint ? <p className={styles.skFieldHint}>{hint}</p> : null}
    </div>
  );
}

function templateToFormState(template: SajiloKanunDocumentTemplate): TemplateFormState {
  return {
    nameEn: template.name.en,
    nameNe: template.name.ne === template.name.en ? "" : template.name.ne,
    nameRoman: template.name.roman ?? "",
    descriptionEn: template.description.en,
    descriptionNe:
      template.description.ne === template.description.en
        ? ""
        : template.description.ne,
    courtType: template.courtType,
    documentKind: template.documentKind,
    status: template.status,
    variables: template.variables.map((variable) => ({ ...variable })),
    file: null,
  };
}

function getPaginationItems(
  current: number,
  totalPages: number
): Array<{ type: "page"; page: number } | { type: "ellipsis" }> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({
      type: "page" as const,
      page: i + 1,
    }));
  }

  const items: Array<{ type: "page"; page: number } | { type: "ellipsis" }> = [
    { type: "page", page: 1 },
  ];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(totalPages - 1, current + 1);

  if (windowStart > 2) items.push({ type: "ellipsis" });
  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push({ type: "page", page });
  }
  if (windowEnd < totalPages - 1) items.push({ type: "ellipsis" });
  items.push({ type: "page", page: totalPages });
  return items;
}

function VariablesEditor({
  variables,
  onAdd,
  onUpdate,
  onRemove,
}: {
  variables: SkTemplateVariable[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<SkTemplateVariable>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <div className={styles.panelHeader} style={{ marginBottom: "0.5rem" }}>
        <h4 className={styles.skSubheading}>Template variables</h4>
        <button type="button" className={styles.skSmallBtn} onClick={onAdd}>
          Add variable
        </button>
      </div>
      {variables.length === 0 ? (
        <p className={styles.panelDesc}>
          No variables yet — upload a DOCX with {"{placeholders}"} or add manually.
        </p>
      ) : (
        variables.map((variable, index) => (
          <div
            key={`${variable.key}-${index}`}
            className={styles.skRoleFormGrid}
            style={{ marginBottom: "0.5rem" }}
          >
            <input
              className={styles.filterInput}
              placeholder="key e.g. applicant_name"
              value={variable.key}
              onChange={(e) => onUpdate(index, { key: e.target.value })}
            />
            <input
              className={styles.filterInput}
              placeholder="Label (English)"
              value={variable.label.en}
              onChange={(e) =>
                onUpdate(index, {
                  label: { ...variable.label, en: e.target.value },
                })
              }
            />
            <input
              className={styles.filterInput}
              placeholder="Label (Nepali)"
              value={variable.label.ne}
              onChange={(e) =>
                onUpdate(index, {
                  label: { ...variable.label, ne: e.target.value },
                })
              }
            />
            <select
              className={styles.filterSelect}
              value={variable.type}
              onChange={(e) =>
                onUpdate(index, {
                  type: e.target.value as SkTemplateVariable["type"],
                })
              }
            >
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="number">Number</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input
                type="checkbox"
                checked={variable.required}
                onChange={(e) => onUpdate(index, { required: e.target.checked })}
              />
              Required
            </label>
            <button
              type="button"
              className={styles.skSmallBtn}
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function AdminSajiloKanunTemplatesPanel() {
  const [templates, setTemplates] = useState<SajiloKanunDocumentTemplate[]>([]);
  const [meta, setMeta] = useState<SkTemplateMeta | null>(null);
  const [createForm, setCreateForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<TemplateFormState | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<SajiloKanunDocumentTemplate | null>(null);
  const [documentEditorTemplate, setDocumentEditorTemplate] =
    useState<SajiloKanunDocumentTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filterCourtType, setFilterCourtType] = useState<CourtType | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, nextMeta] = await Promise.all([
        adminFetchSkTemplates(),
        adminFetchSkTemplateMeta(),
      ]);
      setTemplates(list);
      setMeta(nextMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCourtType, pageSize]);

  useEffect(() => {
    if (!editingTemplate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setEditingTemplate(null);
        setEditForm(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingTemplate, saving]);

  function cancelEdit() {
    setEditingTemplate(null);
    setEditForm(null);
  }

  function startEdit(template: SajiloKanunDocumentTemplate) {
    setEditingTemplate(template);
    setEditForm(templateToFormState(template));
    setShowCreateForm(false);
    setError("");
  }

  function addVariable(target: "create" | "edit") {
    if (target === "create") {
      setCreateForm((current) => ({
        ...current,
        variables: [...current.variables, { ...EMPTY_VARIABLE }],
      }));
      return;
    }
    setEditForm((current) =>
      current
        ? { ...current, variables: [...current.variables, { ...EMPTY_VARIABLE }] }
        : current
    );
  }

  function updateVariable(
    target: "create" | "edit",
    index: number,
    patch: Partial<SkTemplateVariable>
  ) {
    const mapVars = (vars: SkTemplateVariable[]) =>
      vars.map((item, i) => (i === index ? { ...item, ...patch } : item));
    if (target === "create") {
      setCreateForm((current) => ({
        ...current,
        variables: mapVars(current.variables),
      }));
      return;
    }
    setEditForm((current) =>
      current ? { ...current, variables: mapVars(current.variables) } : current
    );
  }

  function removeVariable(target: "create" | "edit", index: number) {
    if (target === "create") {
      setCreateForm((current) => ({
        ...current,
        variables: current.variables.filter((_, i) => i !== index),
      }));
      return;
    }
    setEditForm((current) =>
      current
        ? {
            ...current,
            variables: current.variables.filter((_, i) => i !== index),
          }
        : current
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.file || !createForm.courtType || !createForm.documentKind) {
      setError("Court type, document kind, and template file are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fileData = await readFileAsBase64(createForm.file);
      await adminCreateSkTemplate({
        nameEn: createForm.nameEn,
        nameNe: createForm.nameNe,
        nameRoman: createForm.nameRoman,
        descriptionEn: createForm.descriptionEn,
        descriptionNe: createForm.descriptionNe,
        courtType: createForm.courtType,
        documentKind: createForm.documentKind,
        variables: createForm.variables,
        status: createForm.status,
        fileName: createForm.file.name,
        fileData,
      });
      setCreateForm(EMPTY_FORM);
      setShowCreateForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTemplate || !editForm) return;
    if (!editForm.courtType || !editForm.documentKind) {
      setError("Court type and document kind are required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: Parameters<typeof adminUpdateSkTemplate>[1] = {
        nameEn: editForm.nameEn,
        nameNe: editForm.nameNe,
        nameRoman: editForm.nameRoman,
        descriptionEn: editForm.descriptionEn,
        descriptionNe: editForm.descriptionNe,
        courtType: editForm.courtType,
        documentKind: editForm.documentKind,
        status: editForm.status,
        variables: editForm.variables,
      };
      if (editForm.file) {
        payload.fileName = editForm.file.name;
        payload.fileData = await readFileAsBase64(editForm.file);
      }
      await adminUpdateSkTemplate(editingTemplate.id, payload);
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(template: SajiloKanunDocumentTemplate) {
    setBusyId(template.id);
    setError("");
    try {
      await adminUpdateSkTemplate(template.id, {
        status: template.status === "published" ? "draft" : "published",
      });
      if (editingTemplate?.id === template.id) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this Sajilo Kanun template?")) return;
    setBusyId(id);
    setError("");
    try {
      await adminDeleteSkTemplate(id);
      if (editingTemplate?.id === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(template: SajiloKanunDocumentTemplate) {
    setBusyId(template.id);
    setError("");
    try {
      const blob = await adminFetchSkTemplateFile(template.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        template.originalFileName?.trim() ||
        `${template.slug || "template"}.${template.fileType === "pdf" ? "pdf" : "docx"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download template file"
      );
    } finally {
      setBusyId(null);
    }
  }

  const visibleTemplates = useMemo(
    () =>
      filterCourtType === "all"
        ? templates
        : templates.filter((t) => t.courtType === filterCourtType),
    [templates, filterCourtType]
  );

  const totalCount = visibleTemplates.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = totalCount === 0 ? 0 : (activePage - 1) * pageSize;
  const pageTemplates = visibleTemplates.slice(startIndex, startIndex + pageSize);
  const documentKindOptions = meta?.documentKinds ?? [];
  const editDocumentKindMissing =
    Boolean(editForm?.documentKind) &&
    !documentKindOptions.some((kind) => kind.id === editForm?.documentKind);

  return (
    <section id="sajilo-kanun-templates" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Sajilo Kanun document templates</h2>
        <div className={styles.panelHeaderActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              setShowCreateForm((open) => !open);
              cancelEdit();
            }}
          >
            {showCreateForm ? "Close" : "Add template"}
          </button>
        </div>
      </div>
      <p className={styles.panelDesc}>
        Upload DOCX templates per <strong>court type</strong> (जिल्ला / उच्च / सर्वोच्च /
        विशेष) and <strong>document kind</strong>. Use {"{placeholders}"} — same list/edit
        flow as ward templates. Variables and prompts can be filled in gradually.
      </p>
      {error ? <p className={styles.formError}>{error}</p> : null}

      {documentEditorTemplate ? (
        <AdminSajiloKanunTemplateEditor
          template={documentEditorTemplate}
          onClose={() => setDocumentEditorTemplate(null)}
          onSaved={async () => {
            if (editingTemplate?.id === documentEditorTemplate.id) {
              cancelEdit();
            }
            await load();
          }}
        />
      ) : null}

      {editForm && editingTemplate ? (
        <div
          className={styles.wardTemplateEditorBackdrop}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !saving) cancelEdit();
          }}
        >
          <div
            className={styles.skTemplateSettingsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sk-template-settings-title"
          >
            <header className={styles.skTemplateSettingsModalHeader}>
              <div>
                <h3 id="sk-template-settings-title">Edit template settings</h3>
                <p className={styles.skEditUserHint}>
                  Current file: {editingTemplate.originalFileName} (
                  {editingTemplate.fileType.toUpperCase()})
                  {editForm.file
                    ? ` → will be replaced by ${editForm.file.name}`
                    : null}
                </p>
              </div>
              <div className={styles.wardTemplateEditorActions}>
                <button
                  type="button"
                  className={styles.skSmallBtn}
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="sk-template-edit-form"
                  className={styles.btnPrimary}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </header>
            <div className={styles.skTemplateSettingsModalBody}>
              <form
                id="sk-template-edit-form"
                className={`${styles.skAddMemberCard} ${styles.skEditUserCard}`}
                onSubmit={handleEditSave}
              >
                <div className={styles.skRoleFormGrid}>
                  <FormField label="Name (English)" htmlFor="sk-edit-name-en" required>
                    <input
                      id="sk-edit-name-en"
                      className={styles.filterInput}
                      value={editForm.nameEn}
                      onChange={(e) =>
                        setEditForm((c) => (c ? { ...c, nameEn: e.target.value } : c))
                      }
                      required
                    />
                  </FormField>
                  <FormField label="Name (Nepali)" htmlFor="sk-edit-name-ne">
                    <input
                      id="sk-edit-name-ne"
                      className={styles.filterInput}
                      value={editForm.nameNe}
                      onChange={(e) =>
                        setEditForm((c) => (c ? { ...c, nameNe: e.target.value } : c))
                      }
                    />
                  </FormField>
                  <FormField
                    label="Name (Roman Nepali)"
                    htmlFor="sk-edit-name-roman"
                    hint="Used for search — auto-filled from Nepali if left blank on save."
                  >
                    <input
                      id="sk-edit-name-roman"
                      className={styles.filterInput}
                      value={editForm.nameRoman}
                      onChange={(e) =>
                        setEditForm((c) =>
                          c ? { ...c, nameRoman: e.target.value } : c
                        )
                      }
                      placeholder="e.g. Tarikh Sakar Gari Paun"
                    />
                  </FormField>
                  <FormField label="Court type" htmlFor="sk-edit-court" required>
                    <select
                      id="sk-edit-court"
                      className={styles.filterSelect}
                      value={editForm.courtType}
                      required
                      onChange={(e) =>
                        setEditForm((c) =>
                          c ? { ...c, courtType: e.target.value as CourtType } : c
                        )
                      }
                    >
                      {(meta?.courtTypes ?? []).map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.labelNe} ({ct.labelEn})
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Document kind" htmlFor="sk-edit-kind" required>
                    <select
                      id="sk-edit-kind"
                      className={styles.filterSelect}
                      value={editForm.documentKind}
                      required
                      onChange={(e) =>
                        setEditForm((c) =>
                          c
                            ? {
                                ...c,
                                documentKind: e.target.value as LegalCaseDocumentKind,
                              }
                            : c
                        )
                      }
                    >
                      {editDocumentKindMissing && editForm.documentKind ? (
                        <option value={editForm.documentKind}>
                          {editingTemplate.documentKindTitle || editForm.documentKind}
                        </option>
                      ) : null}
                      {documentKindOptions.map((kind) => (
                        <option key={kind.id} value={kind.id}>
                          {kind.title}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Status" htmlFor="sk-edit-status">
                    <select
                      id="sk-edit-status"
                      className={styles.filterSelect}
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((c) =>
                          c
                            ? {
                                ...c,
                                status: e.target.value as "draft" | "published",
                              }
                            : c
                        )
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </FormField>
                  <FormField
                    label="Re-upload file"
                    htmlFor="sk-edit-file"
                    hint="Optional. New DOCX fully replaces the current file."
                  >
                    <input
                      id="sk-edit-file"
                      className={styles.filterInput}
                      type="file"
                      accept=".docx,.pdf"
                      onChange={(e) =>
                        setEditForm((c) =>
                          c ? { ...c, file: e.target.files?.[0] ?? null } : c
                        )
                      }
                    />
                  </FormField>
                </div>
                <VariablesEditor
                  variables={editForm.variables}
                  onAdd={() => addVariable("edit")}
                  onUpdate={(index, patch) => updateVariable("edit", index, patch)}
                  onRemove={(index) => removeVariable("edit", index)}
                />
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateForm ? (
        <form className={styles.skAddMemberCard} onSubmit={handleCreate}>
          <h3 className={styles.skSubheading}>Add template</h3>
          <div className={styles.skRoleFormGrid}>
            <FormField label="Name (English)" htmlFor="sk-create-name-en" required>
              <input
                id="sk-create-name-en"
                className={styles.filterInput}
                value={createForm.nameEn}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, nameEn: e.target.value }))
                }
                required
              />
            </FormField>
            <FormField label="Name (Nepali)" htmlFor="sk-create-name-ne">
              <input
                id="sk-create-name-ne"
                className={styles.filterInput}
                value={createForm.nameNe}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, nameNe: e.target.value }))
                }
              />
            </FormField>
            <FormField
              label="Name (Roman Nepali)"
              htmlFor="sk-create-name-roman"
              hint="Optional. Auto-generated from Nepali name if empty."
            >
              <input
                id="sk-create-name-roman"
                className={styles.filterInput}
                value={createForm.nameRoman}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, nameRoman: e.target.value }))
                }
                placeholder="e.g. Tarikh Sakar Gari Paun"
              />
            </FormField>
            <FormField label="Court type" htmlFor="sk-create-court" required>
              <select
                id="sk-create-court"
                className={styles.filterSelect}
                value={createForm.courtType}
                required
                onChange={(e) =>
                  setCreateForm((c) => ({
                    ...c,
                    courtType: e.target.value as CourtType,
                  }))
                }
              >
                <option value="">Select…</option>
                {(meta?.courtTypes ?? []).map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.labelNe} ({ct.labelEn})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Document kind" htmlFor="sk-create-kind" required>
              <select
                id="sk-create-kind"
                className={styles.filterSelect}
                value={createForm.documentKind}
                required
                onChange={(e) =>
                  setCreateForm((c) => ({
                    ...c,
                    documentKind: e.target.value as LegalCaseDocumentKind,
                  }))
                }
              >
                <option value="">Select…</option>
                {documentKindOptions.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="sk-create-status">
              <select
                id="sk-create-status"
                className={styles.filterSelect}
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((c) => ({
                    ...c,
                    status: e.target.value as "draft" | "published",
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormField>
            <FormField label="Template file" htmlFor="sk-create-file" required>
              <input
                id="sk-create-file"
                className={styles.filterInput}
                type="file"
                accept=".docx,.pdf"
                required
                onChange={(e) =>
                  setCreateForm((c) => ({
                    ...c,
                    file: e.target.files?.[0] ?? null,
                  }))
                }
              />
            </FormField>
          </div>
          <VariablesEditor
            variables={createForm.variables}
            onAdd={() => addVariable("create")}
            onUpdate={(index, patch) => updateVariable("create", index, patch)}
            onRemove={(index) => removeVariable("create", index)}
          />
          <div className={styles.skAddMemberFormActions}>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Upload template"}
            </button>
          </div>
        </form>
      ) : null}

      <div className={styles.panelHeader} style={{ marginTop: "1rem" }}>
        <label className={styles.skFieldLabel} htmlFor="sk-filter-court">
          Filter by court type
        </label>
        <select
          id="sk-filter-court"
          className={styles.filterSelect}
          value={filterCourtType}
          onChange={(e) =>
            setFilterCourtType(e.target.value as CourtType | "all")
          }
        >
          <option value="all">All</option>
          {(meta?.courtTypes ?? []).map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.labelNe}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className={styles.panelDesc}>Loading…</p>
      ) : (
        <>
          <div className={styles.tblWrap} style={{ marginTop: "1rem" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Court type</th>
                  <th>Document</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.skEmptyCell}>
                      No Sajilo Kanun templates yet.
                    </td>
                  </tr>
                ) : (
                  pageTemplates.map((template) => (
                    <tr key={template.id}>
                      <td>
                        <strong>{template.name.en}</strong>
                        {template.name.ne ? <div>{template.name.ne}</div> : null}
                        {template.name.roman ? (
                          <div className={styles.panelDesc} style={{ margin: 0 }}>
                            {template.name.roman}
                          </div>
                        ) : null}
                      </td>
                      <td>{COURT_TYPE_META[template.courtType].labelNe}</td>
                      <td>{template.documentKindTitle}</td>
                      <td>
                        {template.originalFileName}
                        <div>{template.fileType.toUpperCase()}</div>
                      </td>
                      <td>{template.status}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === template.id || saving}
                          onClick={() => startEdit(template)}
                        >
                          Settings
                        </button>{" "}
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === template.id || saving}
                          onClick={() => void handleDownload(template)}
                        >
                          {busyId === template.id ? "Downloading…" : "Download"}
                        </button>{" "}
                        {template.fileType === "docx" ? (
                          <>
                            <button
                              type="button"
                              className={styles.skSmallBtn}
                              disabled={busyId === template.id || saving}
                              onClick={() => {
                                setDocumentEditorTemplate(template);
                                setError("");
                              }}
                            >
                              Edit document
                            </button>{" "}
                          </>
                        ) : null}
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === template.id}
                          onClick={() => void togglePublish(template)}
                        >
                          {template.status === "published" ? "Unpublish" : "Publish"}
                        </button>{" "}
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === template.id}
                          onClick={() => void handleDelete(template.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalCount > 0 ? (
            <div className={styles.skTemplatePagination}>
              <div>
                Showing {startIndex + 1}–
                {Math.min(startIndex + pageTemplates.length, totalCount)} of{" "}
                <strong>{totalCount}</strong> templates
              </div>
              <div className={styles.skTemplatePaginationControls}>
                <label className={styles.skFieldLabel} htmlFor="sk-page-size">
                  Per page
                </label>
                <select
                  id="sk-page-size"
                  className={styles.filterSelect}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <button
                  type="button"
                  className={styles.skTemplatePageBtn}
                  disabled={activePage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  Prev
                </button>
                <div className={styles.skTemplatePaginationPages}>
                  {getPaginationItems(activePage, totalPages).map((item, index) =>
                    item.type === "ellipsis" ? (
                      <span key={`ellipsis-${index}`}>…</span>
                    ) : (
                      <button
                        key={item.page}
                        type="button"
                        className={`${styles.skTemplatePageBtn}${
                          item.page === activePage
                            ? ` ${styles.skTemplatePageBtnActive}`
                            : ""
                        }`}
                        onClick={() => setCurrentPage(item.page)}
                      >
                        {item.page}
                      </button>
                    )
                  )}
                </div>
                <button
                  type="button"
                  className={styles.skTemplatePageBtn}
                  disabled={activePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
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
  );
}
