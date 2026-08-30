"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  { value: "nagarpalika", label: "Nagarpalika" },
  { value: "gaupalika", label: "Gaupalika" },
  { value: "mahanagarpalika", label: "Mahanagarpalika" },
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

export function AdminWardOperatorsPanel() {
  const [operators, setOperators] = useState<WardOperatorProfile[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.generationLimit.trim() !== "") {
      const limit = Number(form.generationLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        setError("Generation limit must be a positive whole number");
        return;
      }
    }
    setBusyId("create");
    try {
      await adminCreateWardOperator({
        ...form,
        generationLimit:
          form.generationLimit.trim() === ""
            ? null
            : Number(form.generationLimit),
      });
      setForm(EMPTY_FORM);
      setShowPassword(false);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ward operator");
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
            onClick={() => setShowForm((open) => !open)}
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
        <form className={styles.skAddMemberCard} onSubmit={handleCreate}>
          <h3 className={styles.skSubheading}>New ward operator</h3>
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
              hint="Minimum 8 characters"
              required
            >
              <div className={styles.passwordFieldWrap}>
                <input
                  id="ward-password"
                  className={styles.filterInput}
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
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
            <button type="submit" className={styles.btnPrimary} disabled={busyId === "create"}>
              {busyId === "create" ? "Creating…" : "Create operator"}
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
                      <div className={styles.skMemberActions}>
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === operator.id}
                          onClick={() => void updateGenerationLimit(operator)}
                        >
                          Set limit
                        </button>
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === operator.id}
                          onClick={() => void resetGenerationCount(operator)}
                        >
                          Reset count
                        </button>
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === operator.id}
                          onClick={() => void toggleActive(operator)}
                        >
                          {operator.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
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
