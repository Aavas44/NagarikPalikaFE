"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminCreateTeam,
  adminCreateTeamAccount,
  adminFetchTeamAccounts,
  adminFetchTeams,
  adminUpdateAccount,
  adminUpdateTeam,
  type AdminTeam,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import { authedFetch } from "@/lib/auth";
import { formatTokenCount } from "@/lib/sajilokanun/token-usage";
import styles from "@/app/admin.module.css";

export function AdminSajiloKanunPanel() {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TeamMember[]>([]);
  const [teamName, setTeamName] = useState("");
  const [accountForm, setAccountForm] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "admin" as "admin" | "member",
  });
  const [usageSummary, setUsageSummary] = useState<{
    billableTokens: number;
    totalTokens: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTeamDetails = useCallback(async (teamId: string) => {
    const [accts, usageRes] = await Promise.all([
      adminFetchTeamAccounts(teamId),
      authedFetch(`/admin/teams/${teamId}/usage?limit=1`),
    ]);
    setAccounts(accts);
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      setUsageSummary(usageData.usage ?? null);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    const data = await adminFetchTeams();
    setTeams(data);
    setSelectedTeamId((current) => current ?? data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadTeams();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load teams");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTeams]);

  useEffect(() => {
    if (!selectedTeamId) return;
    void loadTeamDetails(selectedTeamId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load team");
    });
  }, [selectedTeamId, loadTeamDetails]);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const team = await adminCreateTeam(teamName);
      setTeamName("");
      await loadTeams();
      setSelectedTeamId(team.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamId) return;
    setError("");
    try {
      await adminCreateTeamAccount(selectedTeamId, accountForm);
      setAccountForm({ username: "", password: "", name: "", email: "", role: "admin" });
      await loadTeamDetails(selectedTeamId);
      await loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    }
  }

  async function toggleTeamActive(team: AdminTeam) {
    await adminUpdateTeam(team.id, { active: !team.active });
    await loadTeams();
  }

  async function toggleAccountActive(account: TeamMember) {
    await adminUpdateAccount(account.id, { active: !account.active });
    if (selectedTeamId) await loadTeamDetails(selectedTeamId);
  }

  if (loading) {
    return (
      <section id="sajilo-kanun-teams" className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Sajilo Kanun — Law firms</h2>
        </div>
        <p className={styles.panelDesc}>Loading…</p>
      </section>
    );
  }

  return (
    <section id="sajilo-kanun-teams" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Sajilo Kanun — Law firms</h2>
      </div>
      <p className={styles.panelDesc}>
        Create law firm teams, firm admins, and members. Token usage is scoped per team.
      </p>

      {error && <p className={styles.formError}>{error}</p>}

      <form onSubmit={handleCreateTeam} className={styles.skInlineForm}>
        <input
          type="text"
          placeholder="New firm name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className={styles.filterInput}
          style={{ maxWidth: 280 }}
          required
        />
        <button type="submit" className={styles.btnPrimary}>
          Create firm
        </button>
      </form>

      <div className={`${styles.skPanelBody} ${styles.skTwoCol}`}>
        <div>
          <h3 className={styles.skSubheading}>Firms</h3>
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    className={selectedTeamId === team.id ? styles.skRowSelected : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.skLinkBtn}
                        onClick={() => setSelectedTeamId(team.id)}
                      >
                        {team.name}
                      </button>
                    </td>
                    <td>{team.memberCount ?? 0}</td>
                    <td>{team.active ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.skSmallBtn}
                        onClick={() => void toggleTeamActive(team)}
                      >
                        {team.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedTeamId && (
          <div>
            <h3 className={styles.skSubheading}>Accounts & usage</h3>

            {usageSummary && (
              <div className={styles.metrics} style={{ marginBottom: "1rem" }}>
                <div className={styles.metric}>
                  <div className={styles.metricVal}>
                    {formatTokenCount(usageSummary.billableTokens)}
                  </div>
                  <div className={styles.metricLabel}>Billable tokens</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricVal}>
                    {formatTokenCount(usageSummary.totalTokens)}
                  </div>
                  <div className={styles.metricLabel}>Total tokens</div>
                </div>
              </div>
            )}

            <div className={styles.tblWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name}</td>
                      <td>{account.username}</td>
                      <td>{account.role ?? "—"}</td>
                      <td>{account.active ? "Active" : "Inactive"}</td>
                      <td>
                        {account.role === "member" && (
                          <button
                            type="button"
                            className={styles.skSmallBtn}
                            onClick={() => void toggleAccountActive(account)}
                          >
                            {account.active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleCreateAccount} className={styles.addFormStacked}>
              <h4 className={styles.skSubheading}>Add account</h4>
              <div className={styles.formGroup}>
                <input
                  className={styles.filterInput}
                  placeholder="Username"
                  value={accountForm.username}
                  onChange={(e) => setAccountForm((f) => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  className={styles.filterInput}
                  type="password"
                  placeholder="Password"
                  value={accountForm.password}
                  onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  className={styles.filterInput}
                  placeholder="Full name"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  className={styles.filterInput}
                  type="email"
                  placeholder="Email (optional)"
                  value={accountForm.email}
                  onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <select
                  className={styles.filterSelect}
                  value={accountForm.role}
                  onChange={(e) =>
                    setAccountForm((f) => ({
                      ...f,
                      role: e.target.value as "admin" | "member",
                    }))
                  }
                >
                  <option value="admin">Firm admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
              <button type="submit" className={styles.btnPrimary}>
                Create account
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
