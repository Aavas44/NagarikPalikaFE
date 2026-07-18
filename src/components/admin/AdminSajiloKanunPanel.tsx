"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminCreateDirectoryPerson,
  adminCreateTeam,
  adminCreateTeamAccount,
  adminFetchDirectory,
  adminFetchRolePolicies,
  adminFetchTeamAccounts,
  adminFetchTeams,
  adminUpdateAccount,
  adminUpdateRolePolicy,
  adminUpdateTeam,
  type AdminTeam,
  type DirectoryPerson,
  type DirectoryUserType,
  type RoleKey,
  type RolePermissionDefinition,
  type RolePolicyRecord,
  type TeamMember,
} from "@/lib/sajilokanun-access";
import { authedFetch } from "@/lib/auth";
import { formatTokenCount } from "@/lib/sajilokanun/token-usage";
import styles from "@/app/admin.module.css";

type AccountRole = "admin" | "member";
type AssignableRole = "superadmin" | "admin" | "firm_admin" | "member";

type AccountFormState = {
  username: string;
  password: string;
  name: string;
  email: string;
  contactNo: string;
};

type DirectoryFormState = {
  name: string;
  username: string;
  password: string;
  email: string;
  contactNo: string;
  userType: DirectoryUserType;
  role: AssignableRole;
  firmId: string;
};

const EMPTY_FORM: AccountFormState = {
  username: "",
  password: "",
  name: "",
  email: "",
  contactNo: "",
};

const EMPTY_DIRECTORY_FORM: DirectoryFormState = {
  name: "",
  username: "",
  password: "",
  email: "",
  contactNo: "",
  userType: "member",
  role: "member",
  firmId: "",
};

// Kept for the legacy account-assignment markup below. Role permissions are
// now loaded from the server and edited in the dedicated role-policy view.
const ADMIN_PERMISSIONS = ["Firm administration"];
const MEMBER_PERMISSIONS = ["Standard member access"];

function formatCreatedAt(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isFirmAssignable(userType: DirectoryUserType, role: AssignableRole) {
  return (
    userType === "firm_admin" ||
    userType === "member" ||
    role === "firm_admin" ||
    role === "member"
  );
}

function AdminAccountRow({
  account,
  busyId,
  onToggleActive,
  onChangeRole,
}: {
  account: TeamMember;
  busyId: string | null;
  onToggleActive: (account: TeamMember) => void;
  onChangeRole: (account: TeamMember, role: AccountRole) => void;
}) {
  const busy = busyId === account.id;

  return (
    <tr>
      <td>
        <div className={styles.skPersonName}>{account.name}</div>
        {account.email ? (
          <div className={styles.skPersonMeta}>{account.email}</div>
        ) : null}
      </td>
      <td>
        <code className={styles.skUsername}>{account.username}</code>
      </td>
      <td>
        <span
          className={`${styles.skStatusPill} ${
            account.active ? styles.skStatusActive : styles.skStatusInactive
          }`}
        >
          {account.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <div className={styles.skActionRow}>
          <button
            type="button"
            className={styles.skSmallBtn}
            disabled={busy}
            onClick={() => onToggleActive(account)}
          >
            {account.active ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            className={styles.skSmallBtn}
            disabled={busy}
            onClick={() => onChangeRole(account, "member")}
          >
            Make member
          </button>
        </div>
      </td>
    </tr>
  );
}

function DirectoryPersonRow({
  person,
  firms,
  busyId,
  onToggleActive,
  onChangeRole,
  onMoveFirm,
}: {
  person: DirectoryPerson;
  firms: AdminTeam[];
  busyId: string | null;
  onToggleActive: (person: DirectoryPerson) => void;
  onChangeRole: (person: DirectoryPerson, role: AccountRole) => void;
  onMoveFirm: (person: DirectoryPerson, firmId: string) => void;
}) {
  const busy = busyId === person.id;
  const isPlatform = person.kind === "platform";
  const currentFirmId = person.teamId ?? "";

  return (
    <tr>
      <td>
        <div className={styles.skPersonName}>{person.name}</div>
        {person.email ? (
          <div className={styles.skPersonMeta}>{person.email}</div>
        ) : null}
        <div className={styles.skPersonMeta}>
          <code className={styles.skUsername}>{person.username}</code>
        </div>
      </td>
      <td>{person.contactNo?.trim() ? person.contactNo : "—"}</td>
      <td>{person.firmName?.trim() ? person.firmName : "—"}</td>
      <td>
        <span className={styles.skUserTypeBadge}>
          {person.userType ?? "—"}
        </span>
      </td>
      <td>{formatCreatedAt(person.createdAt)}</td>
      <td>{person.createdByName?.trim() ? person.createdByName : "—"}</td>
      <td>
        <span
          className={`${styles.skStatusPill} ${
            person.active ? styles.skStatusActive : styles.skStatusInactive
          }`}
        >
          {person.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        {isPlatform ? (
          <span className={styles.skPersonMeta}>Platform account</span>
        ) : (
          <div className={styles.skMemberActions}>
            <select
              className={styles.filterSelect}
              value={currentFirmId}
              disabled={busy || firms.length === 0}
              aria-label={`Move ${person.name} to firm`}
              onChange={(e) => {
                const nextFirmId = e.target.value;
                if (!nextFirmId || nextFirmId === currentFirmId) return;
                onMoveFirm(person, nextFirmId);
              }}
            >
              {firms.map((firm) => (
                <option
                  key={firm.id}
                  value={firm.id}
                  disabled={!firm.active && firm.id !== currentFirmId}
                >
                  {firm.active ? firm.name : `${firm.name} (inactive)`}
                </option>
              ))}
            </select>
            <div className={styles.skActionRow}>
              <button
                type="button"
                className={styles.skSmallBtn}
                disabled={busy}
                onClick={() => onToggleActive(person)}
              >
                {person.active ? "Deactivate" : "Activate"}
              </button>
              {person.role === "admin" ? (
                <button
                  type="button"
                  className={styles.skSmallBtn}
                  disabled={busy}
                  onClick={() => onChangeRole(person, "member")}
                >
                  Make member
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.skSmallBtn}
                  disabled={busy}
                  onClick={() => onChangeRole(person, "admin")}
                >
                  Make admin
                </button>
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function MemberDetailRow({
  account,
  firms,
  busyId,
  showFirmColumn,
  onToggleActive,
  onChangeRole,
  onMoveFirm,
}: {
  account: TeamMember;
  firms: AdminTeam[];
  busyId: string | null;
  showFirmColumn?: boolean;
  onToggleActive: (account: TeamMember) => void;
  onChangeRole: (account: TeamMember, role: AccountRole) => void;
  onMoveFirm: (account: TeamMember, firmId: string) => void;
}) {
  const busy = busyId === account.id;
  const currentFirmId = account.teamId ?? "";

  return (
    <tr>
      <td>
        <div className={styles.skPersonName}>{account.name}</div>
        {account.email ? (
          <div className={styles.skPersonMeta}>{account.email}</div>
        ) : null}
        <div className={styles.skPersonMeta}>
          <code className={styles.skUsername}>{account.username}</code>
        </div>
      </td>
      <td>{account.contactNo?.trim() ? account.contactNo : "—"}</td>
      {showFirmColumn ? (
        <td>{account.firmName?.trim() ? account.firmName : "—"}</td>
      ) : null}
      <td>
        <span className={styles.skUserTypeBadge}>
          {account.userType ?? (account.role === "admin" ? "Firm admin" : "Member")}
        </span>
      </td>
      <td>{formatCreatedAt(account.createdAt)}</td>
      <td>{account.createdByName?.trim() ? account.createdByName : "—"}</td>
      <td>
        <span
          className={`${styles.skStatusPill} ${
            account.active ? styles.skStatusActive : styles.skStatusInactive
          }`}
        >
          {account.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <div className={styles.skMemberActions}>
          <select
            className={styles.filterSelect}
            value={currentFirmId}
            disabled={busy || firms.length === 0}
            aria-label={`Move ${account.name} to firm`}
            onChange={(e) => {
              const nextFirmId = e.target.value;
              if (!nextFirmId || nextFirmId === currentFirmId) return;
              onMoveFirm(account, nextFirmId);
            }}
          >
            {firms.map((firm) => (
              <option key={firm.id} value={firm.id} disabled={!firm.active && firm.id !== currentFirmId}>
                {firm.active ? firm.name : `${firm.name} (inactive)`}
              </option>
            ))}
          </select>
          <div className={styles.skActionRow}>
            <button
              type="button"
              className={styles.skSmallBtn}
              disabled={busy}
              onClick={() => onToggleActive(account)}
            >
              {account.active ? "Deactivate" : "Activate"}
            </button>
            {account.role === "admin" ? (
              <button
                type="button"
                className={styles.skSmallBtn}
                disabled={busy}
                onClick={() => onChangeRole(account, "member")}
              >
                Make member
              </button>
            ) : (
              <button
                type="button"
                className={styles.skSmallBtn}
                disabled={busy}
                onClick={() => onChangeRole(account, "admin")}
              >
                Make admin
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function AccountFormFields({
  form,
  setForm,
  includeContact,
}: {
  form: AccountFormState;
  setForm: (next: AccountFormState) => void;
  includeContact?: boolean;
}) {
  return (
    <div className={styles.skRoleFormGrid}>
      <input
        className={styles.filterInput}
        placeholder="Full name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        className={styles.filterInput}
        placeholder="Username"
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
        required
      />
      <input
        className={styles.filterInput}
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
      />
      <input
        className={styles.filterInput}
        type="email"
        placeholder="Email (optional)"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      {includeContact ? (
        <input
          className={styles.filterInput}
          placeholder="Contact no (optional)"
          value={form.contactNo}
          onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
        />
      ) : null}
    </div>
  );
}

export function AdminSajiloKanunPanel({
  section = "firms",
}: {
  section?: "firms" | "roles" | "members";
}) {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TeamMember[]>([]);
  const [allMembers, setAllMembers] = useState<DirectoryPerson[]>([]);
  const [rolePolicies, setRolePolicies] = useState<RolePolicyRecord[]>([]);
  const [permissionCatalog, setPermissionCatalog] =
    useState<RolePermissionDefinition[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<
    Partial<Record<RoleKey, string[]>>
  >({});
  const [teamName, setTeamName] = useState("");
  const [adminForm, setAdminForm] = useState<AccountFormState>(EMPTY_FORM);
  const [memberForm, setMemberForm] = useState<AccountFormState>(EMPTY_FORM);
  const [directoryForm, setDirectoryForm] =
    useState<DirectoryFormState>(EMPTY_DIRECTORY_FORM);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{
    billableTokens: number;
    totalTokens: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const admins = useMemo(
    () => accounts.filter((account) => account.role === "admin"),
    [accounts]
  );
  const members = useMemo(
    () => accounts.filter((account) => account.role !== "admin"),
    [accounts]
  );

  const loadAllMembers = useCallback(async () => {
    const data = await adminFetchDirectory();
    setAllMembers(data);
  }, []);

  const loadRolePolicies = useCallback(async () => {
    const data = await adminFetchRolePolicies();
    setRolePolicies(data.roles);
    setPermissionCatalog(data.permissions);
    setDraftPermissions(
      Object.fromEntries(
        data.roles.map((role) => [role.key, [...role.permissions]])
      ) as Partial<Record<RoleKey, string[]>>
    );
  }, []);

  const needsFirm =
    isFirmAssignable(directoryForm.userType, directoryForm.role);

  const loadTeamDetails = useCallback(async (teamId: string) => {
    const [accts, usageRes] = await Promise.all([
      adminFetchTeamAccounts(teamId),
      authedFetch(`/admin/teams/${teamId}/usage?limit=1`),
    ]);
    setAccounts(accts);
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      setUsageSummary(usageData.usage ?? null);
    } else {
      setUsageSummary(null);
    }
  }, []);

  const loadTeams = useCallback(async () => {
    const data = await adminFetchTeams();
    setTeams(data);
    setSelectedTeamId((current) => {
      if (current && data.some((team) => team.id === current)) return current;
      return data[0]?.id ?? null;
    });
  }, []);

  const refreshAll = useCallback(async () => {
    await loadTeams();
    await loadAllMembers();
    if (selectedTeamId) await loadTeamDetails(selectedTeamId);
  }, [loadTeams, loadAllMembers, loadTeamDetails, selectedTeamId]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        if (section === "roles") {
          await loadRolePolicies();
        } else {
          await Promise.all([loadTeams(), loadAllMembers()]);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : section === "roles"
              ? "Failed to load roles"
              : "Failed to load firms"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [section, loadTeams, loadAllMembers, loadRolePolicies]);

  useEffect(() => {
    if (!selectedTeamId) return;
    void loadTeamDetails(selectedTeamId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load firm");
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
      setError(err instanceof Error ? err.message : "Failed to create firm");
    }
  }

  async function handleCreateAccount(role: AccountRole, form: AccountFormState) {
    if (!selectedTeamId) return;
    setError("");
    setBusyId(`create-${role}`);
    try {
      await adminCreateTeamAccount(selectedTeamId, {
        username: form.username,
        password: form.password,
        name: form.name,
        email: form.email || undefined,
        contactNo: form.contactNo || undefined,
        role,
      });
      if (role === "admin") setAdminForm(EMPTY_FORM);
      else setMemberForm(EMPTY_FORM);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTeamActive(team: AdminTeam) {
    setError("");
    setBusyId(team.id);
    try {
      await adminUpdateTeam(team.id, { active: !team.active });
      await loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update firm");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAccountActive(account: TeamMember) {
    setError("");
    setBusyId(account.id);
    try {
      await adminUpdateAccount(account.id, { active: !account.active });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setBusyId(null);
    }
  }

  async function changeAccountRole(account: TeamMember, role: AccountRole) {
    setError("");
    setBusyId(account.id);
    try {
      await adminUpdateAccount(account.id, { role });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setBusyId(null);
    }
  }

  async function moveAccountFirm(account: TeamMember, firmId: string) {
    setError("");
    setBusyId(account.id);
    try {
      await adminUpdateAccount(account.id, { teamId: firmId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move member");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateDirectoryPerson(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusyId("create-directory");
    try {
      await adminCreateDirectoryPerson({
        name: directoryForm.name,
        password: directoryForm.password,
        email: directoryForm.email || undefined,
        contactNo: directoryForm.contactNo || undefined,
        username: directoryForm.username || undefined,
        userType: directoryForm.userType,
        role: directoryForm.role,
        firmId: needsFirm ? directoryForm.firmId : undefined,
      });
      setDirectoryForm({
        ...EMPTY_DIRECTORY_FORM,
        firmId: teams[0]?.id ?? "",
      });
      setShowAddUserForm(false);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDirectoryActive(person: DirectoryPerson) {
    if (person.kind !== "firm") return;
    setError("");
    setBusyId(person.id);
    try {
      await adminUpdateAccount(person.id, { active: !person.active });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setBusyId(null);
    }
  }

  async function changeDirectoryRole(person: DirectoryPerson, role: AccountRole) {
    if (person.kind !== "firm") return;
    setError("");
    setBusyId(person.id);
    try {
      await adminUpdateAccount(person.id, { role });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role");
    } finally {
      setBusyId(null);
    }
  }

  async function moveDirectoryFirm(person: DirectoryPerson, firmId: string) {
    if (person.kind !== "firm") return;
    setError("");
    setBusyId(person.id);
    try {
      await adminUpdateAccount(person.id, { teamId: firmId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move member");
    } finally {
      setBusyId(null);
    }
  }

  function toggleRolePermission(
    roleKey: RoleKey,
    permissionKey: string,
    locked = false
  ) {
    if (locked) return;
    setDraftPermissions((current) => {
      const selected =
        current[roleKey] ??
        rolePolicies.find((role) => role.key === roleKey)?.permissions ??
        [];
      return {
        ...current,
        [roleKey]: selected.includes(permissionKey)
          ? selected.filter((permission) => permission !== permissionKey)
          : [...selected, permissionKey],
      };
    });
  }

  async function saveRolePolicy(roleKey: RoleKey) {
    setError("");
    setBusyId(`role-${roleKey}`);
    try {
      const updated = await adminUpdateRolePolicy(
        roleKey,
        draftPermissions[roleKey] ?? []
      );
      setRolePolicies((current) =>
        current.map((role) => (role.key === roleKey ? updated : role))
      );
      setDraftPermissions((current) => ({
        ...current,
        [roleKey]: [...updated.permissions],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!directoryForm.firmId && teams[0]?.id) {
      setDirectoryForm((form) => ({ ...form, firmId: teams[0].id }));
    }
  }, [teams, directoryForm.firmId]);

  if (loading) {
    const title =
      section === "members"
        ? "Sajilo Kanun — Members"
        : section === "roles"
          ? "Sajilo Kanun — Roles"
          : "Sajilo Kanun — Firms";
    return (
      <section
        id={
          section === "members"
            ? "sajilo-kanun-members"
            : section === "roles"
              ? "sajilo-kanun-roles"
              : "sajilo-kanun-firms"
        }
        className={styles.panel}
      >
        <div className={styles.panelHeader}>
          <h2>{title}</h2>
        </div>
        <p className={styles.panelDesc}>Loading…</p>
      </section>
    );
  }

  if (section === "roles") {
    return (
      <section id="sajilo-kanun-roles" className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Sajilo Kanun — Roles</h2>
        </div>
        <p className={styles.panelDesc}>
          Configure the permissions granted to each available role. Changes are
          enforced by the API for platform administration, firm members, cases,
          and usage access.
        </p>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.skRolePolicyGrid}>
          {rolePolicies.length === 0 ? (
            <div className={styles.skEmptyDetail}>Loading available roles…</div>
          ) : (
            rolePolicies.map((role) => {
              const permissions = permissionCatalog.filter((permission) =>
                permission.roles.includes(role.key)
              );
              const selected = draftPermissions[role.key] ?? role.permissions;
              const isDirty =
                [...selected].sort().join("|") !==
                [...role.permissions].sort().join("|");

              return (
                <article key={role.key} className={styles.skRolePolicyCard}>
                  <div className={styles.skRoleHeader}>
                    <div>
                      <div className={styles.skRolePolicyTitleRow}>
                        <h3 className={styles.skRoleTitle}>{role.name}</h3>
                        <span className={styles.skUserTypeBadge}>{role.scope}</span>
                      </div>
                      <p className={styles.skRoleDesc}>{role.description}</p>
                    </div>
                  </div>

                  <div className={styles.skPermissionEditor}>
                    {permissions.map((permission) => {
                      const locked =
                        permission.locked === true &&
                        role.key === "platform.superadmin";
                      return (
                        <label
                          key={permission.key}
                          className={`${styles.skPermissionOption} ${
                            locked ? styles.skPermissionOptionLocked : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(permission.key)}
                            disabled={locked || busyId === `role-${role.key}`}
                            onChange={() =>
                              toggleRolePermission(
                                role.key,
                                permission.key,
                                locked
                              )
                            }
                          />
                          <span>
                            <strong>{permission.label}</strong>
                            <small>{permission.description}</small>
                            {locked ? <em>Required</em> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className={styles.skRolePolicyActions}>
                    <span>
                      {selected.length} permission
                      {selected.length === 1 ? "" : "s"} enabled
                    </span>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={!isDirty || busyId === `role-${role.key}`}
                      onClick={() => void saveRolePolicy(role.key)}
                    >
                      {busyId === `role-${role.key}` ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    );
  }

  if (section === "members") {
    return (
      <section id="sajilo-kanun-members" className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Sajilo Kanun — Members</h2>
          <div className={styles.panelHeaderActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowAddUserForm((open) => !open)}
            >
              {showAddUserForm ? "Close" : "Add User"}
            </button>
          </div>
        </div>
        <p className={styles.panelDesc}>
          Platform superadmins and admins, plus every firm admin and member.
          Use Add User to create accounts, then manage firm assignment from the
          directory.
        </p>

        {error && <p className={styles.formError}>{error}</p>}

        {showAddUserForm && (
        <div className={styles.skAddMemberCard}>
          <h3 className={styles.skSubheading}>Add user</h3>
          <form
            className={styles.skRoleForm}
            onSubmit={(e) => void handleCreateDirectoryPerson(e)}
          >
            <div className={styles.skRoleFormGrid}>
              <input
                className={styles.filterInput}
                placeholder="Full name"
                value={directoryForm.name}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <input
                className={styles.filterInput}
                type="email"
                placeholder="Email"
                value={directoryForm.email}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, email: e.target.value }))
                }
                required={
                  directoryForm.userType === "superadmin" ||
                  directoryForm.userType === "admin" ||
                  directoryForm.role === "superadmin" ||
                  directoryForm.role === "admin"
                }
              />
              <input
                className={styles.filterInput}
                placeholder="Username (firm login)"
                value={directoryForm.username}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, username: e.target.value }))
                }
                required={needsFirm}
              />
              <input
                className={styles.filterInput}
                type="password"
                placeholder="Password"
                value={directoryForm.password}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, password: e.target.value }))
                }
                required
              />
              <input
                className={styles.filterInput}
                placeholder="Contact no"
                value={directoryForm.contactNo}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, contactNo: e.target.value }))
                }
              />
              <select
                className={styles.filterSelect}
                value={directoryForm.userType}
                onChange={(e) => {
                  const userType = e.target.value as DirectoryUserType;
                  setDirectoryForm((f) => ({
                    ...f,
                    userType,
                    role:
                      userType === "firm_admin"
                        ? "firm_admin"
                        : userType === "member"
                          ? "member"
                          : userType,
                  }));
                }}
                required
              >
                <option value="superadmin">User type: Superadmin</option>
                <option value="admin">User type: Admin</option>
                <option value="firm_admin">User type: Firm admin</option>
                <option value="member">User type: Member</option>
              </select>
              <select
                className={styles.filterSelect}
                value={directoryForm.role}
                onChange={(e) =>
                  setDirectoryForm((f) => ({
                    ...f,
                    role: e.target.value as AssignableRole,
                  }))
                }
                required
              >
                <option value="superadmin">Role: Superadmin</option>
                <option value="admin">Role: Admin</option>
                <option value="firm_admin">Role: Firm admin</option>
                <option value="member">Role: Member</option>
              </select>
              <select
                className={styles.filterSelect}
                value={directoryForm.firmId}
                onChange={(e) =>
                  setDirectoryForm((f) => ({ ...f, firmId: e.target.value }))
                }
                required={needsFirm}
                disabled={!needsFirm}
              >
                <option value="">
                  {needsFirm ? "Select firm" : "Firm (not required)"}
                </option>
                {teams.map((firm) => (
                  <option key={firm.id} value={firm.id} disabled={!firm.active}>
                    {firm.active ? firm.name : `${firm.name} (inactive)`}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.skAddMemberFormActions}>
              <button
                type="button"
                className={styles.skSmallBtn}
                onClick={() => setShowAddUserForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={!!busyId}
              >
                Create account
              </button>
            </div>
          </form>
        </div>
        )}

        <div className={styles.skDirectory}>
          <h3 className={styles.skSubheading}>
            All people
            <span className={styles.skRoleCount}>{allMembers.length}</span>
          </h3>
          <div className={styles.tblWrap}>
            <table className={`${styles.table} ${styles.skMemberTable}`}>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Contact no</th>
                  <th>Firm</th>
                  <th>User type</th>
                  <th>Created</th>
                  <th>Created by</th>
                  <th>Status</th>
                  <th>Move firm / actions</th>
                </tr>
              </thead>
              <tbody>
                {allMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.skEmptyCell}>
                      No accounts yet.
                    </td>
                  </tr>
                ) : (
                  allMembers.map((person) => (
                    <DirectoryPersonRow
                      key={`${person.kind}-${person.id}`}
                      person={person}
                      firms={teams}
                      busyId={busyId}
                      onToggleActive={(p) => void toggleDirectoryActive(p)}
                      onChangeRole={(p, role) => void changeDirectoryRole(p, role)}
                      onMoveFirm={(p, firmId) => void moveDirectoryFirm(p, firmId)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  if (selectedTeam && false) {
    return (
      <section id="sajilo-kanun-roles" className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Sajilo Kanun — Roles</h2>
        </div>
        <p className={styles.panelDesc}>
          Assign firm admin and member roles for a selected firm. Each role has
          fixed permissions listed below.
        </p>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={`${styles.skPanelBody} ${styles.skTwoCol}`}>
          <div>
            <h3 className={styles.skSubheading}>Select firm</h3>
            <div className={styles.tblWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Firm</th>
                    <th>People</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.length === 0 ? (
                    <tr>
                      <td colSpan={3} className={styles.skEmptyCell}>
                        No firms yet. Create one under Firms first.
                      </td>
                    </tr>
                  ) : (
                    teams.map((team) => (
                      <tr
                        key={team.id}
                        className={
                          selectedTeamId === team.id
                            ? styles.skRowSelected
                            : undefined
                        }
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
                        <td>
                          <span
                            className={`${styles.skStatusPill} ${
                              team.active
                                ? styles.skStatusActive
                                : styles.skStatusInactive
                            }`}
                          >
                            {team.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedTeam ? (
            <div className={styles.skTeamDetail}>
              <div className={styles.skTeamDetailHeader}>
                <div>
                  <h3 className={styles.skSubheading}>{selectedTeam?.name}</h3>
                  <p className={styles.skTeamDetailMeta}>
                    Manage who has firm admin vs member access.
                  </p>
                </div>
              </div>

              <div className={`${styles.skRoleSection} ${styles.skRoleSectionAdmin}`}>
                <div className={styles.skRoleHeader}>
                  <div>
                    <h4 className={styles.skRoleTitle}>
                      Firm admins
                      <span className={styles.skRoleCount}>{admins.length}</span>
                    </h4>
                    <p className={styles.skRoleDesc}>Full control of this firm.</p>
                  </div>
                </div>
                <ul className={styles.skPermissionList}>
                  {ADMIN_PERMISSIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className={styles.tblWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={styles.skEmptyCell}>
                            No firm admins assigned yet.
                          </td>
                        </tr>
                      ) : (
                        admins.map((account) => (
                          <AdminAccountRow
                            key={account.id}
                            account={account}
                            busyId={busyId}
                            onToggleActive={(a) => void toggleAccountActive(a)}
                            onChangeRole={(a, role) => void changeAccountRole(a, role)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <form
                  className={styles.skRoleForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleCreateAccount("admin", adminForm);
                  }}
                >
                  <AccountFormFields form={adminForm} setForm={setAdminForm} />
                  <button type="submit" className={styles.btnPrimary} disabled={!!busyId}>
                    Add firm admin
                  </button>
                </form>
              </div>

              <div className={`${styles.skRoleSection} ${styles.skRoleSectionMember}`}>
                <div className={styles.skRoleHeader}>
                  <div>
                    <h4 className={styles.skRoleTitle}>
                      Members
                      <span className={styles.skRoleCount}>{members.length}</span>
                    </h4>
                    <p className={styles.skRoleDesc}>
                      Standard access for lawyers in this firm.
                    </p>
                  </div>
                </div>
                <ul className={styles.skPermissionList}>
                  {MEMBER_PERMISSIONS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className={styles.tblWrap}>
                  <table className={`${styles.table} ${styles.skMemberTable}`}>
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Contact no</th>
                        <th>User type</th>
                        <th>Created</th>
                        <th>Created by</th>
                        <th>Status</th>
                        <th>Move firm / actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={styles.skEmptyCell}>
                            No members assigned yet.
                          </td>
                        </tr>
                      ) : (
                        members.map((account) => (
                          <MemberDetailRow
                            key={account.id}
                            account={account}
                            firms={teams}
                            busyId={busyId}
                            onToggleActive={(a) => void toggleAccountActive(a)}
                            onChangeRole={(a, role) => void changeAccountRole(a, role)}
                            onMoveFirm={(a, firmId) => void moveAccountFirm(a, firmId)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <form
                  className={styles.skRoleForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleCreateAccount("member", memberForm);
                  }}
                >
                  <AccountFormFields
                    form={memberForm}
                    setForm={setMemberForm}
                    includeContact
                  />
                  <button type="submit" className={styles.btnPrimary} disabled={!!busyId}>
                    Add member
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className={styles.skEmptyDetail}>
              Select a firm to assign admin and member roles.
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id="sajilo-kanun-firms" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Sajilo Kanun — Firms</h2>
      </div>
      <p className={styles.panelDesc}>
        Create and activate law firms. Assign people and roles from Roles and
        Members.
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

      <div className={styles.skPanelBody}>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Firm</th>
                <th>People</th>
                <th>Status</th>
                <th>Usage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.skEmptyCell}>
                    No firms yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr
                    key={team.id}
                    className={
                      selectedTeamId === team.id ? styles.skRowSelected : undefined
                    }
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
                    <td>
                      <span
                        className={`${styles.skStatusPill} ${
                          team.active
                            ? styles.skStatusActive
                            : styles.skStatusInactive
                        }`}
                      >
                        {team.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {selectedTeamId === team.id && usageSummary ? (
                        <span className={styles.skPersonMeta}>
                          {formatTokenCount(usageSummary.billableTokens)} billable
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.skSmallBtn}
                        disabled={busyId === team.id}
                        onClick={() => void toggleTeamActive(team)}
                      >
                        {team.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
