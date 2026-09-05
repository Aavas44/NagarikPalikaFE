"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  WARD_BUILTIN_VARIABLES,
  adminCreateWardTemplate,
  adminDeleteWardTemplate,
  adminFetchWardTemplateFile,
  adminFetchWardTemplates,
  adminUpdateWardTemplate,
  readFileAsBase64,
  type WardDocumentTemplate,
  type WardTemplateVariable,
} from "@/lib/ward-access";
import styles from "@/app/admin.module.css";
import { AdminWardTemplateEditor } from "./AdminWardTemplateEditor";

const EMPTY_VARIABLE: WardTemplateVariable = {
  key: "",
  label: { en: "", ne: "" },
  type: "text",
  required: true,
};

type TemplateFormState = {
  nameEn: string;
  nameNe: string;
  descriptionEn: string;
  descriptionNe: string;
  status: "draft" | "published";
  variables: WardTemplateVariable[];
  file: File | null;
};

const EMPTY_FORM: TemplateFormState = {
  nameEn: "",
  nameNe: "",
  descriptionEn: "",
  descriptionNe: "",
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

function templateToFormState(template: WardDocumentTemplate): TemplateFormState {
  return {
    nameEn: template.name.en,
    nameNe: template.name.ne === template.name.en ? "" : template.name.ne,
    descriptionEn: template.description.en,
    descriptionNe:
      template.description.ne === template.description.en
        ? ""
        : template.description.ne,
    status: template.status,
    variables: template.variables.map((variable) => ({ ...variable })),
    file: null,
  };
}

function VariablesEditor({
  variables,
  onAdd,
  onUpdate,
  onRemove,
  emptyMessage,
}: {
  variables: WardTemplateVariable[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<WardTemplateVariable>) => void;
  onRemove: (index: number) => void;
  emptyMessage: string;
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
        <p className={styles.panelDesc}>{emptyMessage}</p>
      ) : (
        variables.map((variable, index) => (
          <div
            key={`${variable.key}-${index}`}
            className={styles.skRoleFormGrid}
            style={{ marginBottom: "0.5rem" }}
          >
            <input
              className={styles.filterInput}
              placeholder="key e.g. citizen_name"
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
                  type: e.target.value as WardTemplateVariable["type"],
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

export function AdminWardTemplatesPanel() {
  const [templates, setTemplates] = useState<WardDocumentTemplate[]>([]);
  const [createForm, setCreateForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<TemplateFormState | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WardDocumentTemplate | null>(
    null
  );
  const [documentEditorTemplate, setDocumentEditorTemplate] =
    useState<WardDocumentTemplate | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTemplates(await adminFetchWardTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(template: WardDocumentTemplate) {
    setEditingTemplate(template);
    setEditForm(templateToFormState(template));
    setShowCreateForm(false);
    setError("");
  }

  function cancelEdit() {
    setEditingTemplate(null);
    setEditForm(null);
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
        ? {
            ...current,
            variables: [...current.variables, { ...EMPTY_VARIABLE }],
          }
        : current
    );
  }

  function updateVariable(
    target: "create" | "edit",
    index: number,
    patch: Partial<WardTemplateVariable>
  ) {
    if (target === "create") {
      setCreateForm((current) => ({
        ...current,
        variables: current.variables.map((item, i) =>
          i === index ? { ...item, ...patch } : item
        ),
      }));
      return;
    }
    setEditForm((current) =>
      current
        ? {
            ...current,
            variables: current.variables.map((item, i) =>
              i === index ? { ...item, ...patch } : item
            ),
          }
        : current
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
    if (!createForm.file) {
      setError("Template file (DOCX or PDF) is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fileData = await readFileAsBase64(createForm.file);
      await adminCreateWardTemplate({
        nameEn: createForm.nameEn,
        nameNe: createForm.nameNe,
        descriptionEn: createForm.descriptionEn,
        descriptionNe: createForm.descriptionNe,
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

    setSaving(true);
    setError("");
    try {
      const payload: Parameters<typeof adminUpdateWardTemplate>[1] = {
        nameEn: editForm.nameEn,
        nameNe: editForm.nameNe,
        descriptionEn: editForm.descriptionEn,
        descriptionNe: editForm.descriptionNe,
        status: editForm.status,
        variables: editForm.variables,
      };

      if (editForm.file) {
        payload.fileName = editForm.file.name;
        payload.fileData = await readFileAsBase64(editForm.file);
      }

      await adminUpdateWardTemplate(editingTemplate.id, payload);
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(template: WardDocumentTemplate) {
    setBusyId(template.id);
    setError("");
    try {
      await adminUpdateWardTemplate(template.id, {
        status: template.status === "published" ? "draft" : "published",
      });
      if (editingTemplate?.id === template.id) {
        cancelEdit();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this ward template?")) return;
    setBusyId(id);
    setError("");
    try {
      await adminDeleteWardTemplate(id);
      if (editingTemplate?.id === id) {
        cancelEdit();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(template: WardDocumentTemplate) {
    setBusyId(template.id);
    setError("");
    try {
      const blob = await adminFetchWardTemplateFile(template.id);
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

  return (
    <section id="ward-templates" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Ward document templates</h2>
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
        Upload DOCX templates with placeholders like {"{citizen_name}"}. Built-in
        profile fields are always available:{" "}
        {WARD_BUILTIN_VARIABLES.map((v) => v.key).join(", ")}.
        DOCX generation is supported; PDF upload is stored but fill is not yet enabled.
        For DOCX templates, use <strong>Edit document</strong> to change text or add{" "}
        {"{placeholders}"} in the browser.
      </p>
      {error ? <p className={styles.formError}>{error}</p> : null}

      {documentEditorTemplate ? (
        <AdminWardTemplateEditor
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
        <form
          className={`${styles.skAddMemberCard} ${styles.skEditUserCard}`}
          onSubmit={handleEditSave}
        >
          <h3 className={styles.skSubheading}>Template settings</h3>
          <p className={styles.skEditUserHint}>
            Current file: {editingTemplate.originalFileName} (
            {editingTemplate.fileType.toUpperCase()})
            {editForm.file
              ? ` → will be replaced by ${editForm.file.name}`
              : null}
          </p>
          <div className={styles.skRoleFormGrid}>
            <FormField label="Template name (English)" htmlFor="edit-template-name-en" required>
              <input
                id="edit-template-name-en"
                className={styles.filterInput}
                value={editForm.nameEn}
                onChange={(e) =>
                  setEditForm((current) =>
                    current ? { ...current, nameEn: e.target.value } : current
                  )
                }
                required
              />
            </FormField>
            <FormField label="Template name (Nepali)" htmlFor="edit-template-name-ne">
              <input
                id="edit-template-name-ne"
                className={styles.filterInput}
                value={editForm.nameNe}
                onChange={(e) =>
                  setEditForm((current) =>
                    current ? { ...current, nameNe: e.target.value } : current
                  )
                }
              />
            </FormField>
            <FormField label="Description (English)" htmlFor="edit-template-desc-en">
              <input
                id="edit-template-desc-en"
                className={styles.filterInput}
                value={editForm.descriptionEn}
                onChange={(e) =>
                  setEditForm((current) =>
                    current ? { ...current, descriptionEn: e.target.value } : current
                  )
                }
              />
            </FormField>
            <FormField label="Description (Nepali)" htmlFor="edit-template-desc-ne">
              <input
                id="edit-template-desc-ne"
                className={styles.filterInput}
                value={editForm.descriptionNe}
                onChange={(e) =>
                  setEditForm((current) =>
                    current ? { ...current, descriptionNe: e.target.value } : current
                  )
                }
              />
            </FormField>
            <FormField label="Status" htmlFor="edit-template-status">
              <select
                id="edit-template-status"
                className={styles.filterSelect}
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          status: e.target.value as "draft" | "published",
                        }
                      : current
                  )
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormField>
            <FormField
              label="Re-upload template file"
              htmlFor="edit-template-file"
              hint="Optional. The new DOCX/PDF fully replaces the current file. DOCX placeholders are re-detected and old variables not in the new file are removed."
            >
              <input
                id="edit-template-file"
                className={styles.filterInput}
                type="file"
                accept=".docx,.pdf"
                onChange={(e) => {
                  const nextFile = e.target.files?.[0] ?? null;
                  setEditForm((current) =>
                    current ? { ...current, file: nextFile } : current
                  );
                }}
              />
            </FormField>
          </div>

          <VariablesEditor
            variables={editForm.variables}
            onAdd={() => addVariable("edit")}
            onUpdate={(index, patch) => updateVariable("edit", index, patch)}
            onRemove={(index) => removeVariable("edit", index)}
            emptyMessage="No configured variables. Re-upload a DOCX to auto-detect placeholders, or add variables manually."
          />

          <div className={styles.skAddMemberFormActions}>
            <button type="button" className={styles.skSmallBtn} onClick={cancelEdit}>
              Cancel
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      ) : null}

      {showCreateForm ? (
        <form className={styles.skAddMemberCard} onSubmit={handleCreate}>
          <h3 className={styles.skSubheading}>Add template</h3>
          <div className={styles.skRoleFormGrid}>
            <FormField label="Template name (English)" htmlFor="create-template-name-en" required>
              <input
                id="create-template-name-en"
                className={styles.filterInput}
                value={createForm.nameEn}
                onChange={(e) =>
                  setCreateForm((current) => ({ ...current, nameEn: e.target.value }))
                }
                required
              />
            </FormField>
            <FormField label="Template name (Nepali)" htmlFor="create-template-name-ne">
              <input
                id="create-template-name-ne"
                className={styles.filterInput}
                value={createForm.nameNe}
                onChange={(e) =>
                  setCreateForm((current) => ({ ...current, nameNe: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Description (English)" htmlFor="create-template-desc-en">
              <input
                id="create-template-desc-en"
                className={styles.filterInput}
                value={createForm.descriptionEn}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    descriptionEn: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Description (Nepali)" htmlFor="create-template-desc-ne">
              <input
                id="create-template-desc-ne"
                className={styles.filterInput}
                value={createForm.descriptionNe}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    descriptionNe: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Status" htmlFor="create-template-status">
              <select
                id="create-template-status"
                className={styles.filterSelect}
                value={createForm.status}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: e.target.value as "draft" | "published",
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormField>
            <FormField label="Template file" htmlFor="create-template-file" required>
              <input
                id="create-template-file"
                className={styles.filterInput}
                type="file"
                accept=".docx,.pdf"
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    file: e.target.files?.[0] ?? null,
                  }))
                }
                required
              />
            </FormField>
          </div>

          <VariablesEditor
            variables={createForm.variables}
            onAdd={() => addVariable("create")}
            onUpdate={(index, patch) => updateVariable("create", index, patch)}
            onRemove={(index) => removeVariable("create", index)}
            emptyMessage="No extra variables — only built-in ward profile fields will be used."
          />

          <div className={styles.skAddMemberFormActions}>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Upload template"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className={styles.panelDesc}>Loading…</p>
      ) : (
        <div className={styles.tblWrap} style={{ marginTop: "1.25rem" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>File</th>
                <th>Variables</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.skEmptyCell}>
                    No ward templates yet.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <strong>{template.name.en}</strong>
                      {template.name.ne ? <div>{template.name.ne}</div> : null}
                    </td>
                    <td>
                      {template.originalFileName}
                      <div>{template.fileType.toUpperCase()}</div>
                    </td>
                    <td>{template.variables.length}</td>
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
      )}
    </section>
  );
}
