"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  adminCreateWardOperator,
  adminFetchWardOperators,
  adminUpdateWardOperator,
  formatWardGenerationQuota,
  type LocalBodyType,
  type WardOperatorProfile,
} from "@/lib/ward-access";
import styles from "@/app/admin.module.css";

const LOCAL_BODY_OPTIONS: { value: LocalBodyType; label: string }[] = [
  { value: "nagarpalika", label: "नगरपालिका" },
  { value: "gaupalika", label: "गाउँपालिका" },
  { value: "mahanagarpalika", label: "महानगरपालिका" },
];

const LOCAL_BODY_LABELS = Object.fromEntries(
  LOCAL_BODY_OPTIONS.map((option) => [option.value, option.label])
) as Record<LocalBodyType, string>;

const EMPTY_FORM = {
  username: "",
  email: "",
  password: "",
  operatorName: "",
  districtName: "",
  wardNo: "",
  localBodyType: "nagarpalika" as LocalBodyType,
  localBodyName: "",
  formerLocalBodyType: "nagarpalika" as LocalBodyType,
  formerLocalBodyName: "",
  formerWardNo: "",
  generationLimit: "",
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

function WardOperatorKebabMenu({
  busy,
  active,
  onEdit,
  onSetLimit,
  onResetCount,
  onToggleActive,
}: {
  busy: boolean;
  active: boolean;
  onEdit: () => void;
  onSetLimit: () => void;
  onResetCount: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 180;
    const gap = 6;
    const estimatedHeight = 176;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    setMenuPos({
      top: preferUp ? rect.top - gap : rect.bottom + gap,
      left,
      openUp: preferUp,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  function runAndClose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className={styles.skKebabWrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.skKebabBtn}
        disabled={busy}
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ⋮
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              className={`${styles.skKebabMenu} ${styles.skKebabMenuFixed} ${
                menuPos.openUp ? styles.skKebabMenuUp : ""
              }`}
              role="menu"
              style={{
                top: menuPos.openUp ? undefined : menuPos.top,
                bottom: menuPos.openUp
                  ? window.innerHeight - menuPos.top
                  : undefined,
                left: menuPos.left,
              }}
            >
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onEdit)}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onSetLimit)}
              >
                Set generation limit
              </button>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onResetCount)}
              >
                Reset generation count
              </button>
              <div className={styles.skKebabDivider} />
              <button
                type="button"
                className={`${styles.skKebabItem} ${
                  active ? styles.skKebabItemDanger : ""
                }`}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onToggleActive)}
              >
                {active ? "Deactivate" : "Activate"}
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function AdminWardOperatorsPanel() {
  const [operators, setOperators] = useState<WardOperatorProfile[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOperators(await adminFetchWardOperators());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ward operators");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
  }

  function openCreateForm() {
    if (showForm && !editingId) {
      closeForm();
      return;
    }
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setShowForm(true);
  }

  function openEditForm(operator: WardOperatorProfile) {
    setEditingId(operator.id);
    setForm({
      username: operator.username,
      email: operator.email ?? "",
      password: "",
      operatorName: operator.operatorName,
      districtName: operator.districtName,
      wardNo: operator.wardNo,
      localBodyType: operator.localBodyType,
      localBodyName: operator.localBodyName,
      formerLocalBodyType: operator.formerLocalBodyType,
      formerLocalBodyName: operator.formerLocalBodyName,
      formerWardNo: operator.formerWardNo,
      generationLimit: operator.generationLimit?.toString() ?? "",
    });
    setShowPassword(false);
    setShowForm(true);
    document.getElementById("ward-operators")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.generationLimit.trim() !== "") {
      const limit = Number(form.generationLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        setError("Generation limit must be a positive whole number");
        return;
      }
    }
    if (editingId && form.password.trim() && form.password.trim().length < 8) {
      setError("Password must be at least 8 characters, or leave it blank to keep the current one");
      return;
    }
    setBusyId(editingId ? editingId : "create");
    try {
      const generationLimit =
        form.generationLimit.trim() === ""
          ? null
          : Number(form.generationLimit);
      if (editingId) {
        await adminUpdateWardOperator(editingId, {
          username: form.username,
          email: form.email,
          operatorName: form.operatorName,
          districtName: form.districtName,
          wardNo: form.wardNo,
          localBodyType: form.localBodyType,
          localBodyName: form.localBodyName,
          formerLocalBodyType: form.formerLocalBodyType,
          formerLocalBodyName: form.formerLocalBodyName,
          formerWardNo: form.formerWardNo,
          generationLimit,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
      } else {
        await adminCreateWardOperator({
          ...form,
          generationLimit,
        });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "Failed to update ward operator"
            : "Failed to create ward operator"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(operator: WardOperatorProfile) {
    setBusyId(operator.id);
    setError("");
    try {
      await adminUpdateWardOperator(operator.id, { active: !operator.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ward operator");
    } finally {
      setBusyId(null);
    }
  }

  async function updateGenerationLimit(operator: WardOperatorProfile) {
    const raw = window.prompt(
      "Document generation limit (leave empty for unlimited):",
      operator.generationLimit?.toString() ?? ""
    );
    if (raw === null) return;

    setBusyId(operator.id);
    setError("");
    try {
      await adminUpdateWardOperator(operator.id, {
        generationLimit: raw.trim() === "" ? null : Number(raw.trim()),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update generation limit");
    } finally {
      setBusyId(null);
    }
  }

  async function resetGenerationCount(operator: WardOperatorProfile) {
    if (
      !window.confirm(
        `Reset generation count for ${operator.operatorName} to 0?`
      )
    ) {
      return;
    }

    setBusyId(operator.id);
    setError("");
    try {
      await adminUpdateWardOperator(operator.id, { resetGenerationCount: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset generation count");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="ward-operators" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Ward operators</h2>
        <div className={styles.panelHeaderActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => (showForm ? closeForm() : openCreateForm())}
          >
            {showForm ? "Close" : "Add operator"}
          </button>
        </div>
      </div>
      <p className={styles.panelDesc}>
        Ward operators can sign in at <code>/sajilokanun/login</code> with their username
        or email and password.
      </p>
      {error ? <p className={styles.formError}>{error}</p> : null}

      {showForm ? (
        <form className={styles.skAddMemberCard} onSubmit={handleSubmit}>
          <h3 className={styles.skSubheading}>
            {editingId ? "Edit ward operator" : "New ward operator"}
          </h3>
          <div className={`${styles.skRoleFormGrid} ${styles.wardOperatorFormBody}`}>
            <FormField label="Operator name" htmlFor="ward-operator-name" required>
              <input
                id="ward-operator-name"
                className={styles.filterInput}
                value={form.operatorName}
                onChange={(e) => setForm((f) => ({ ...f, operatorName: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Username" htmlFor="ward-username" required>
              <input
                id="ward-username"
                className={styles.filterInput}
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
                minLength={3}
                maxLength={40}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Email" htmlFor="ward-email" hint="Optional">
              <input
                id="ward-email"
                className={styles.filterInput}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <FormField
              label="Password"
              htmlFor="ward-password"
              hint={
                editingId
                  ? "Leave blank to keep the current password"
                  : "Minimum 8 characters"
              }
              required={!editingId}
            >
              <div className={styles.passwordFieldWrap}>
                <input
                  id="ward-password"
                  className={styles.filterInput}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={!editingId}
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.passwordToggleBtn}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.77 11.77 0 0 1-2.12 3.17M6.11 6.11A11.83 11.83 0 0 0 1 12.5C2.73 16.39 7 19.5 12 19.5c1.52 0 2.98-.27 4.32-.77"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M2 12.5C3.73 8.11 8 5 13 5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S3.73 16.89 2 12.5Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <circle cx="13" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  )}
                </button>
              </div>
            </FormField>
            <FormField
              label="Generation limit"
              htmlFor="ward-generation-limit"
              hint="Leave empty for unlimited document generations"
            >
              <input
                id="ward-generation-limit"
                className={styles.filterInput}
                type="number"
                min={1}
                step={1}
                value={form.generationLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, generationLimit: e.target.value }))
                }
              />
            </FormField>

            <div className={styles.wardAddressRow}>
              <FormField label="District name" htmlFor="ward-district" required>
                <input
                  id="ward-district"
                  className={styles.filterInput}
                  value={form.districtName}
                  onChange={(e) => setForm((f) => ({ ...f, districtName: e.target.value }))}
                  required
                />
              </FormField>

              <div className={styles.wardAddressColumn}>
                <h4 className={styles.wardAddressHeading}>Current address</h4>
                <FormField
                  label="Local body type"
                  htmlFor="ward-local-body-type"
                  required
                >
                  <select
                    id="ward-local-body-type"
                    className={styles.filterSelect}
                    value={form.localBodyType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, localBodyType: e.target.value as LocalBodyType }))
                    }
                  >
                    {LOCAL_BODY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Local body name"
                  htmlFor="ward-local-body-name"
                  required
                >
                  <input
                    id="ward-local-body-name"
                    className={styles.filterInput}
                    value={form.localBodyName}
                    onChange={(e) => setForm((f) => ({ ...f, localBodyName: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Ward no." htmlFor="ward-current-ward" required>
                  <input
                    id="ward-current-ward"
                    className={styles.filterInput}
                    value={form.wardNo}
                    onChange={(e) => setForm((f) => ({ ...f, wardNo: e.target.value }))}
                    required
                  />
                </FormField>
              </div>

              <div className={styles.wardAddressColumn}>
                <h4 className={styles.wardAddressHeading}>Former address</h4>
                <FormField
                  label="Local body type"
                  htmlFor="ward-former-local-body-type"
                  required
                >
                  <select
                    id="ward-former-local-body-type"
                    className={styles.filterSelect}
                    value={form.formerLocalBodyType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        formerLocalBodyType: e.target.value as LocalBodyType,
                      }))
                    }
                  >
                    {LOCAL_BODY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Local body name"
                  htmlFor="ward-former-local-body-name"
                  required
                >
                  <input
                    id="ward-former-local-body-name"
                    className={styles.filterInput}
                    value={form.formerLocalBodyName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, formerLocalBodyName: e.target.value }))
                    }
                    required
                  />
                </FormField>
                <FormField label="Ward no." htmlFor="ward-former-ward" required>
                  <input
                    id="ward-former-ward"
                    className={styles.filterInput}
                    value={form.formerWardNo}
                    onChange={(e) => setForm((f) => ({ ...f, formerWardNo: e.target.value }))}
                    required
                  />
                </FormField>
              </div>
            </div>
          </div>
          <div className={styles.skAddMemberFormActions} style={{ padding: "0 1rem 1rem" }}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={Boolean(busyId)}
            >
              {busyId
                ? editingId
                  ? "Saving…"
                  : "Creating…"
                : editingId
                  ? "Save changes"
                  : "Create operator"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className={styles.panelDesc}>Loading…</p>
      ) : (
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Operator</th>
                <th>Username</th>
                <th>Email</th>
                <th>District</th>
                <th>Current ward</th>
                <th>Local body</th>
                <th>Former</th>
                <th>Generations</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.skEmptyCell}>No ward operators yet.</td>
                </tr>
              ) : (
                operators.map((operator) => (
                  <tr key={operator.id}>
                    <td>{operator.operatorName}</td>
                    <td>{operator.username}</td>
                    <td>{operator.email ?? "—"}</td>
                    <td>{operator.districtName}</td>
                    <td>{operator.wardNo}</td>
                    <td>
                      {LOCAL_BODY_LABELS[operator.localBodyType] ?? operator.localBodyType} —{" "}
                      {operator.localBodyName}
                    </td>
                    <td>
                      {LOCAL_BODY_LABELS[operator.formerLocalBodyType] ??
                        operator.formerLocalBodyType}{" "}
                      — {operator.formerLocalBodyName}, ward {operator.formerWardNo}
                    </td>
                    <td>{formatWardGenerationQuota(operator)}</td>
                    <td>{operator.active ? "Active" : "Inactive"}</td>
                    <td>
                      <WardOperatorKebabMenu
                        busy={busyId === operator.id}
                        active={operator.active}
                        onEdit={() => openEditForm(operator)}
                        onSetLimit={() => void updateGenerationLimit(operator)}
                        onResetCount={() => void resetGenerationCount(operator)}
                        onToggleActive={() => void toggleActive(operator)}
                      />
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
