"use client";

import { useEffect, useState } from "react";
import { SajiloKanunAppShell } from "@/components/sajilokanun/SajiloKanunAppShell";
import shellStyles from "@/components/sajilokanun/SajiloKanunAppShell.module.css";
import {
  createTeamMember,
  fetchSajiloKanunMe,
  fetchTeamMembers,
  updateTeamMember,
  type SajiloKanunUser,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import emiStyles from "@/components/user/emi.module.css";
import pageStyles from "@/app/user.module.css";

export default function SajiloKanunTeamPage() {
  const [user, setUser] = useState<SajiloKanunUser | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [me, teamMembers] = await Promise.all([fetchSajiloKanunMe(), fetchTeamMembers()]);
    setUser(me);
    setMembers(teamMembers.filter((m) => m.role === "member"));
  }

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load team");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createTeamMember(form);
      setForm({ username: "", password: "", name: "", email: "" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create member");
    }
  }

  async function toggleActive(member: TeamMember) {
    try {
      await updateTeamMember(member.id, { active: !member.active });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    }
  }

  if (loading) {
    return (
      <SajiloKanunAppShell title="Team members" subtitle="Loading…">
        <div className={emiStyles.emiPanel}>
          <p className={pageStyles.calculatorSubtitle}>Loading…</p>
        </div>
      </SajiloKanunAppShell>
    );
  }

  if (user?.role !== "admin") {
    return (
      <SajiloKanunAppShell title="Team members">
        <div className={emiStyles.emiPanel}>
          <p className={pageStyles.calculatorSubtitle}>Firm admin access required.</p>
        </div>
      </SajiloKanunAppShell>
    );
  }

  return (
    <SajiloKanunAppShell
      title="Team members"
      subtitle={
        user.teamName
          ? `${user.teamName} — create and manage members`
          : "Create and manage members in your law firm"
      }
    >
      <div className={shellStyles.panelStack}>
        {error && <p className={pageStyles.contactError}>{error}</p>}

        <div className={emiStyles.emiPanel}>
          <h2 className={emiStyles.emiPanelTitle}>Members</h2>
          <div className="space-y-3 md:hidden">
            {members.map((member) => (
              <div key={member.id} className={emiStyles.emiFadeCard} style={{ padding: "1rem" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong style={{ color: "#042c53" }}>{member.name}</strong>
                    <p className={emiStyles.emiFieldHint}>@{member.username}</p>
                    <p className={emiStyles.emiFieldHint}>
                      {member.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={pageStyles.skGateDemoBtn}
                    onClick={() => void toggleActive(member)}
                  >
                    {member.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <p className={pageStyles.calculatorSubtitle}>No members yet.</p>
            )}
          </div>

          <div className={`${emiStyles.emiTableWrap} hidden md:block`}>
            <table className={emiStyles.emiTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr
                    key={member.id}
                    className={index % 2 === 0 ? emiStyles.emiTableRowAlt : undefined}
                  >
                    <td>{member.name}</td>
                    <td>@{member.username}</td>
                    <td>{member.active ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        type="button"
                        className={emiStyles.emiGlossaryLink}
                        style={{ background: "none", border: "none", cursor: "pointer" }}
                        onClick={() => void toggleActive(member)}
                      >
                        {member.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className={emiStyles.emiTableEmpty}>
                      No members yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleCreate} className={emiStyles.emiPanel}>
          <h2 className={emiStyles.emiPanelTitle}>Add member</h2>
          <div className={emiStyles.emiField}>
            <label htmlFor="member-username">Username</label>
            <input
              id="member-username"
              className={emiStyles.emiNumberInput}
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
            />
          </div>
          <div className={emiStyles.emiField}>
            <label htmlFor="member-password">Password</label>
            <input
              id="member-password"
              type="password"
              className={emiStyles.emiNumberInput}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div className={emiStyles.emiField}>
            <label htmlFor="member-name">Full name</label>
            <input
              id="member-name"
              className={emiStyles.emiNumberInput}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className={emiStyles.emiField}>
            <label htmlFor="member-email">Email (optional)</label>
            <input
              id="member-email"
              type="email"
              className={emiStyles.emiNumberInput}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <button type="submit" className={pageStyles.contactSubmit}>
            Create member
          </button>
        </form>
      </div>
    </SajiloKanunAppShell>
  );
}
