"use client";

import { useEffect, useState } from "react";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import {
  createCase,
  fetchCases,
  fetchSajiloKanunMe,
  fetchTeamMembers,
  updateCase,
  type LegalCaseRecord,
  type SajiloKanunUser,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

const CASE_TYPES: LegalCaseRecord["type"][] = ["civil", "criminal", "other"];
const CASE_STATUSES: LegalCaseRecord["status"][] = ["open", "pending", "closed"];

const TYPE_LABELS: Record<LegalCaseRecord["type"], string> = {
  civil: "Civil",
  criminal: "Criminal",
  other: "Other",
};

export default function SajiloKanunCasesPage() {
  const [user, setUser] = useState<SajiloKanunUser | null>(null);
  const [cases, setCases] = useState<LegalCaseRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    caseNo: "",
    type: "civil" as LegalCaseRecord["type"],
    status: "open" as LegalCaseRecord["status"],
    notes: "",
    assignedMemberIds: [] as string[],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";

  async function reload() {
    const me = await fetchSajiloKanunMe();
    setUser(me);
    const caseList = await fetchCases();
    setCases(caseList);
    if (me.role === "admin") {
      const teamMembers = await fetchTeamMembers();
      setMembers(teamMembers.filter((m) => m.role === "member" && m.active));
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cases");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      title: "",
      caseNo: "",
      type: "civil",
      status: "open",
      notes: "",
      assignedMemberIds: [],
    });
  }

  function startEdit(legalCase: LegalCaseRecord) {
    setEditingId(legalCase.id);
    setForm({
      title: legalCase.title,
      caseNo: legalCase.caseNo,
      type: legalCase.type,
      status: legalCase.status,
      notes: legalCase.notes,
      assignedMemberIds: legalCase.assignedMemberIds,
    });
  }

  function toggleAssignee(memberId: string) {
    setForm((f) => ({
      ...f,
      assignedMemberIds: f.assignedMemberIds.includes(memberId)
        ? f.assignedMemberIds.filter((id) => id !== memberId)
        : [...f.assignedMemberIds, memberId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setError("");
    try {
      if (editingId) {
        await updateCase(editingId, form);
      } else {
        await createCase(form);
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save case");
    }
  }

  function memberNames(ids: string[]) {
    return ids
      .map((id) => members.find((m) => m.id === id)?.name ?? id)
      .join(", ");
  }

  if (loading) {
    return (
      <SajiloKanunAppShell title="Cases" subtitle="Loading…">
        <div className={emiStyles.emiPanel}>
          <p className={pageStyles.calculatorSubtitle}>Loading…</p>
        </div>
      </SajiloKanunAppShell>
    );
  }

  return (
    <SajiloKanunAppShell
      title="Cases"
      subtitle={
        isAdmin
          ? "Manage lawsuits and assignments for your law firm."
          : "Cases assigned to you."
      }
    >
      <div className={shellStyles.panelStack}>
        {error && <p className={pageStyles.contactError}>{error}</p>}

        <div className={emiStyles.emiPanel}>
          <h2 className={emiStyles.emiPanelTitle}>
            {isAdmin ? "All cases" : "Your cases"}
          </h2>
          <div className={shellStyles.panelStack} style={{ gap: "0.75rem" }}>
            {cases.map((legalCase) => (
              <article
                key={legalCase.id}
                className={emiStyles.emiFadeCard}
                style={{ padding: "1rem" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong style={{ color: "#042c53" }}>{legalCase.title}</strong>
                    <p className={emiStyles.emiFieldHint}>
                      Case no. {legalCase.caseNo} · {TYPE_LABELS[legalCase.type]} ·{" "}
                      {legalCase.status}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className={emiStyles.emiGlossaryLink}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                      onClick={() => startEdit(legalCase)}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {legalCase.notes && (
                  <p
                    className={pageStyles.calculatorSubtitle}
                    style={{ marginTop: "0.5rem", marginBottom: 0 }}
                  >
                    {legalCase.notes}
                  </p>
                )}
                {legalCase.assignedMemberIds.length > 0 && isAdmin && (
                  <p className={emiStyles.emiFieldHint} style={{ marginTop: "0.5rem" }}>
                    Assigned: {memberNames(legalCase.assignedMemberIds)}
                  </p>
                )}
              </article>
            ))}
            {cases.length === 0 && (
              <p className={pageStyles.calculatorSubtitle}>No cases yet.</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <form onSubmit={handleSubmit} className={emiStyles.emiPanel}>
            <h2 className={emiStyles.emiPanelTitle}>
              {editingId ? "Edit case" : "New case"}
            </h2>
            <div className={emiStyles.emiField}>
              <label htmlFor="case-title">Title</label>
              <input
                id="case-title"
                className={emiStyles.emiNumberInput}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className={emiStyles.emiField}>
              <label htmlFor="case-no">Case number</label>
              <input
                id="case-no"
                className={emiStyles.emiNumberInput}
                value={form.caseNo}
                onChange={(e) => setForm((f) => ({ ...f, caseNo: e.target.value }))}
                required
              />
            </div>
            <div className={emiStyles.emiRow}>
              <div className={emiStyles.emiField}>
                <label htmlFor="case-type">Type</label>
                <select
                  id="case-type"
                  className={emiStyles.emiNumberInput}
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as LegalCaseRecord["type"],
                    }))
                  }
                >
                  {CASE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={emiStyles.emiField}>
                <label htmlFor="case-status">Status</label>
                <select
                  id="case-status"
                  className={emiStyles.emiNumberInput}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as LegalCaseRecord["status"],
                    }))
                  }
                >
                  {CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={emiStyles.emiField}>
              <label htmlFor="case-notes">Notes</label>
              <textarea
                id="case-notes"
                className={emiStyles.emiNumberInput}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ resize: "vertical", minHeight: "5rem" }}
              />
            </div>
            {members.length > 0 && (
              <div className={emiStyles.emiField}>
                <label>Assign members</label>
                <div className={emiStyles.emiPresets} style={{ marginTop: "0.35rem" }}>
                  {members.map((member) => {
                    const active = form.assignedMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={
                          active
                            ? `${emiStyles.emiPreset} ${emiStyles.emiPresetActive}`
                            : emiStyles.emiPreset
                        }
                        onClick={() => toggleAssignee(member.id)}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={emiStyles.emiRow} style={{ marginTop: "0.5rem" }}>
              <button type="submit" className={pageStyles.contactSubmit}>
                {editingId ? "Save changes" : "Create case"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className={pageStyles.skGateDemoBtn}
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </SajiloKanunAppShell>
  );
}
