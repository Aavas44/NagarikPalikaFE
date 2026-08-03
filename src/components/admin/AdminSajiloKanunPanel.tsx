"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FirmSearchSelect } from "@/components/admin/FirmSearchSelect";
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

type EditUserFormState = {
  id: string;
  name: string;
  username: string;
  email: string;
  contactNo: string;
  password: string;
  teamId: string;
  firmName: string;
  label: string;
  isCaseUser: boolean;
  assignedCases: Array<{
    id: string;
    title: string;
    caseNo: string;
    status: string;
  }>;
};

type EditFirmFormState = {
  id: string;
  name: string;
  label: string;
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

function editFormFromPerson(person: DirectoryPerson): EditUserFormState {
  return {
    id: person.id,
    name: person.name ?? "",
    username: person.username ?? "",
    email: person.email ?? "",
    contactNo: person.contactNo ?? "",
    password: "",
    teamId: person.teamId ?? "",
    firmName: person.firmName ?? "",
    label: person.name || person.username,
    isCaseUser:
      person.role === "caseUser" || person.directoryUserType === "case_user",
    assignedCases: person.assignedCases ?? [],
  };
}

function editFormFromMember(account: TeamMember): EditUserFormState {
  return {
    id: account.id,
    name: account.name ?? "",
    username: account.username ?? "",
    email: account.email ?? "",
    contactNo: account.contactNo ?? "",
    password: "",
    teamId: account.teamId ?? "",
    firmName: account.firmName ?? "",
    label: account.name || account.username,
    isCaseUser: account.role === "caseUser",
    assignedCases: [],
  };
}

function editFormFromFirm(team: AdminTeam): EditFirmFormState {
  return {
    id: team.id,
    name: team.name ?? "",
    label: team.name,
  };
}

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

function MemberKebabMenu({
  busy,
  active,
  role,
  onToggleActive,
  onChangeRole,
}: {
  busy: boolean;
  active: boolean;
  role: AccountRole | "caseUser" | null | undefined;
  onToggleActive: () => void;
  onChangeRole: (role: AccountRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canChangeRole = role === "admin" || role === "member";

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.skKebabWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.skKebabBtn}
        disabled={busy}
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.skKebabMenu} role="menu">
          <button
            type="button"
            className={styles.skKebabItem}
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onToggleActive();
            }}
          >
            {active ? "Deactivate" : "Activate"}
          </button>
          {canChangeRole && role === "admin" ? (
            <button
              type="button"
              className={styles.skKebabItem}
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onChangeRole("member");
              }}
            >
              Make firm member
            </button>
          ) : null}
          {canChangeRole && role === "member" ? (
            <button
              type="button"
              className={styles.skKebabItem}
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onChangeRole("admin");
              }}
            >
              Make firm admin
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FirmKebabMenu({
  busy,
  active,
  onToggleActive,
}: {
  busy: boolean;
  active: boolean;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.skKebabWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.skKebabBtn}
        disabled={busy}
        aria-label="More firm actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.skKebabMenu} role="menu">
          <button
            type="button"
            className={styles.skKebabItem}
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onToggleActive();
            }}
          >
            {active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ) : null}
    </div>
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
        <div className={styles.skMemberActions}>
          <MemberKebabMenu
            busy={busy}
            active={account.active}
            role={account.role}
            onToggleActive={() => onToggleActive(account)}
            onChangeRole={(role) => onChangeRole(account, role)}
          />
        </div>
      </td>
    </tr>
  );
}

function DirectoryPersonRow({
  person,
  busyId,
  onEdit,
  onToggleActive,
  onChangeRole,
}: {
  person: DirectoryPerson;
  busyId: string | null;
  onEdit: (person: DirectoryPerson) => void;
  onToggleActive: (person: DirectoryPerson) => void;
  onChangeRole: (person: DirectoryPerson, role: AccountRole) => void;
}) {
  const busy = busyId === person.id;
  const isPlatform = person.kind === "platform";

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
            <button
              type="button"
              className={styles.skSmallBtn}
              disabled={busy}
              onClick={() => onEdit(person)}
            >
              Edit
            </button>
            <MemberKebabMenu
              busy={busy}
              active={person.active}
              role={person.role}
              onToggleActive={() => onToggleActive(person)}
              onChangeRole={(role) => onChangeRole(person, role)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function MemberDetailRow({
  account,
  busyId,
  showFirmColumn,
  onEdit,
  onToggleActive,
  onChangeRole,
}: {
  account: TeamMember;
  busyId: string | null;
  showFirmColumn?: boolean;
  onEdit: (account: TeamMember) => void;
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
          {account.userType ??
            (account.role === "admin"
              ? "Firm admin"
              : account.role === "caseUser"
                ? "Case user"
                : "Firm member")}
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
          <button
            type="button"
            className={styles.skSmallBtn}
            disabled={busy}
            onClick={() => onEdit(account)}
          >
            Edit
          </button>
          <MemberKebabMenu
            busy={busy}
            active={account.active}
            role={account.role}
            onToggleActive={() => onToggleActive(account)}
            onChangeRole={(role) => onChangeRole(account, role)}
          />
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
  const [editUserForm, setEditUserForm] = useState<EditUserFormState | null>(null);
  const [memberFilterUserType, setMemberFilterUserType] = useState<"" | DirectoryUserType>(
    ""
  );
  const [memberFilterFirmId, setMemberFilterFirmId] = useState("");
  const [showAddFirmForm, setShowAddFirmForm] = useState(false);
  const [editFirmForm, setEditFirmForm] = useState<EditFirmFormState | null>(null);
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

  const filteredMembers = useMemo(() => {
    return allMembers.filter((person) => {
      if (memberFilterUserType) {
        const typeKey =
          person.directoryUserType ??
          (person.role === "admin"
            ? "firm_admin"
            : person.role === "caseUser"
              ? "case_user"
              : person.role === "member"
                ? "member"
                : null);
        if (typeKey !== memberFilterUserType) return false;
      }
      if (memberFilterFirmId === "__none__") {
        if (person.teamId) return false;
      } else if (memberFilterFirmId) {
        if (person.teamId !== memberFilterFirmId) return false;
      }
      return true;
    });
  }, [allMembers, memberFilterUserType, memberFilterFirmId]);

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
    setBusyId("create-firm");
    try {
      const team = await adminCreateTeam(teamName);
      setTeamName("");
      setShowAddFirmForm(false);
      await loadTeams();
      setSelectedTeamId(team.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create firm");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEditFirm(e: React.FormEvent) {
    e.preventDefault();
    if (!editFirmForm) return;
    if (!editFirmForm.name.trim()) {
      setError("Firm name is required");
      return;
    }
    setError("");
    setBusyId(editFirmForm.id);
    try {
      await adminUpdateTeam(editFirmForm.id, { name: editFirmForm.name.trim() });
      setEditFirmForm(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update firm");
    } finally {
      setBusyId(null);
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

  async function saveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserForm) return;
    if (!editUserForm.name.trim() || !editUserForm.username.trim()) {
      setError("Name and username are required");
      return;
    }
    if (!editUserForm.isCaseUser && !editUserForm.teamId) {
      setError("Firm is required");
      return;
    }
    setError("");
    setBusyId(editUserForm.id);
    try {
      await adminUpdateAccount(editUserForm.id, {
        name: editUserForm.name.trim(),
        username: editUserForm.username.trim(),
        email: editUserForm.email.trim(),
        contactNo: editUserForm.contactNo.trim(),
        ...(editUserForm.isCaseUser
          ? {}
          : { teamId: editUserForm.teamId }),
        ...(editUserForm.password.trim()
          ? { password: editUserForm.password.trim() }
          : {}),
      });
      setEditUserForm(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
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
    // Leaving a section must close edit/create forms so the members table
    // is visible again when returning to Members.
    setEditUserForm(null);
    setShowAddUserForm(false);
    setEditFirmForm(null);
    setShowAddFirmForm(false);
    setError("");
  }, [section]);

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
              onClick={() => {
                setEditUserForm(null);
                setShowAddUserForm((open) => !open);
              }}
            >
              {showAddUserForm ? "Close" : "Add User"}
            </button>
          </div>
        </div>

        {!editUserForm && (
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={memberFilterUserType}
            onChange={(e) =>
              setMemberFilterUserType(e.target.value as "" | DirectoryUserType)
            }
            aria-label="Filter by user type"
          >
            <option value="">All user types</option>
            <option value="superadmin">Superadmin</option>
            <option value="admin">Admin</option>
            <option value="firm_admin">Firm admin</option>
            <option value="member">Firm member</option>
            <option value="case_user">Case user</option>
          </select>
          <select
            className={styles.filterSelect}
            value={memberFilterFirmId}
            onChange={(e) => setMemberFilterFirmId(e.target.value)}
            aria-label="Filter by firm"
          >
            <option value="">All firms</option>
            <option value="__none__">No firm</option>
            {teams.map((firm) => (
              <option key={firm.id} value={firm.id}>
                {firm.name}
              </option>
            ))}
          </select>
        </div>
        )}

        {error && <p className={styles.formError}>{error}</p>}

        {editUserForm && (
          <div className={`${styles.skAddMemberCard} ${styles.skEditUserCard}`}>
            <h3 className={styles.skSubheading}>
              Edit user — {editUserForm.label}
            </h3>
            <form className={styles.skRoleForm} onSubmit={(e) => void saveEditUser(e)}>
              <div className={styles.skFormSection}>
                <h4 className={styles.skFormSectionTitle}>Account details</h4>
                <div className={styles.skRoleFormGrid}>
                  <label className={styles.skField}>
                    <span className={styles.skFieldLabel}>Name</span>
                    <input
                      className={styles.filterInput}
                      value={editUserForm.name}
                      onChange={(e) =>
                        setEditUserForm((f) =>
                          f ? { ...f, name: e.target.value } : f
                        )
                      }
                      required
                    />
                  </label>
                  <label className={styles.skField}>
                    <span className={styles.skFieldLabel}>Username</span>
                    <input
                      className={styles.filterInput}
                      value={editUserForm.username}
                      onChange={(e) =>
                        setEditUserForm((f) =>
                          f ? { ...f, username: e.target.value } : f
                        )
                      }
                      required
                    />
                  </label>
                  <label className={styles.skField}>
                    <span className={styles.skFieldLabel}>Email</span>
                    <input
                      className={styles.filterInput}
                      type="email"
                      value={editUserForm.email}
                      onChange={(e) =>
                        setEditUserForm((f) =>
                          f ? { ...f, email: e.target.value } : f
                        )
                      }
                    />
                  </label>
                  <label className={styles.skField}>
                    <span className={styles.skFieldLabel}>Contact</span>
                    <input
                      className={styles.filterInput}
                      value={editUserForm.contactNo}
                      onChange={(e) =>
                        setEditUserForm((f) =>
                          f ? { ...f, contactNo: e.target.value } : f
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className={styles.skFormSection}>
                <h4 className={styles.skFormSectionTitle}>Security</h4>
                <label className={styles.skField}>
                  <span className={styles.skFieldLabel}>New password</span>
                  <input
                    className={styles.filterInput}
                    type="password"
                    value={editUserForm.password}
                    onChange={(e) =>
                      setEditUserForm((f) =>
                        f ? { ...f, password: e.target.value } : f
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current password"
                  />
                  <p className={styles.skFieldHint}>
                    Leave blank to keep the current password.
                  </p>
                </label>
              </div>

              <div className={styles.skFormSection}>
                <h4 className={styles.skFormSectionTitle}>Firm</h4>
                {editUserForm.isCaseUser ? (
                  <>
                    <div className={styles.skField}>
                      <span className={styles.skFieldLabel}>Firm</span>
                      <p className={styles.skReadonlyValue}>
                        {editUserForm.firmName?.trim() || "—"}
                      </p>
                      <p className={styles.skFieldHint}>
                        Case users stay on the firm of their assigned case. Firm
                        cannot be changed here.
                      </p>
                    </div>
                    <div className={styles.skField}>
                      <span className={styles.skFieldLabel}>Assigned cases</span>
                      {editUserForm.assignedCases.length === 0 ? (
                        <p className={styles.skReadonlyValue}>No active cases</p>
                      ) : (
                        <ul className={styles.skAssignedCaseList}>
                          {editUserForm.assignedCases.map((legalCase) => (
                            <li key={legalCase.id}>
                              <strong>{legalCase.caseNo || "—"}</strong>
                              <span>{legalCase.title || "Untitled case"}</span>
                              <em>{legalCase.status}</em>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <label className={styles.skField}>
                    <span className={styles.skFieldLabel}>Firm</span>
                    <FirmSearchSelect
                      value={editUserForm.teamId}
                      selectedLabel={editUserForm.firmName}
                      required
                      disabled={busyId === editUserForm.id}
                      onChange={(firmId, firmName) =>
                        setEditUserForm((f) =>
                          f ? { ...f, teamId: firmId, firmName } : f
                        )
                      }
                    />
                    <p className={styles.skFieldHint}>
                      Search firms by name. Results load from the firms API.
                    </p>
                  </label>
                )}
              </div>

              <div className={styles.skAddMemberFormActions}>
                <button
                  type="button"
                  className={styles.skSmallBtn}
                  onClick={() => setEditUserForm(null)}
                >
                  Back to list
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={
                    busyId === editUserForm.id ||
                    (!editUserForm.isCaseUser && !editUserForm.teamId)
                  }
                >
                  {busyId === editUserForm.id ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!editUserForm && showAddUserForm && (
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
                  const role: AssignableRole =
                    userType === "firm_admin"
                      ? "firm_admin"
                      : userType === "member"
                        ? "member"
                        : userType === "admin"
                          ? "admin"
                          : "superadmin";
                  setDirectoryForm((f) => ({
                    ...f,
                    userType,
                    role,
                  }));
                }}
                required
              >
                <option value="superadmin">User type: Superadmin</option>
                <option value="admin">User type: Admin</option>
                <option value="firm_admin">User type: Firm admin</option>
                <option value="member">User type: Firm member</option>
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
                <option value="member">Role: Firm member</option>
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

        {!editUserForm && (
        <div className={styles.skDirectory}>
          <h3 className={styles.skSubheading}>
            All people
            <span className={styles.skRoleCount}>{filteredMembers.length}</span>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.skEmptyCell}>
                      {allMembers.length === 0
                        ? "No accounts yet."
                        : "No people match these filters."}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((person) => (
                    <DirectoryPersonRow
                      key={`${person.kind}-${person.id}`}
                      person={person}
                      busyId={busyId}
                      onEdit={(p) => {
                        setShowAddUserForm(false);
                        setEditUserForm(editFormFromPerson(p));
                      }}
                      onToggleActive={(p) => void toggleDirectoryActive(p)}
                      onChangeRole={(p, role) => void changeDirectoryRole(p, role)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
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
                        <th>Actions</th>
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
                            busyId={busyId}
                            onEdit={(a) => setEditUserForm(editFormFromMember(a))}
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
        <div className={styles.panelHeaderActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              setEditFirmForm(null);
              setShowAddFirmForm((open) => !open);
            }}
          >
            {showAddFirmForm ? "Close" : "Add Firm"}
          </button>
        </div>
      </div>
      <p className={styles.panelDesc}>
        Create and manage law firms. Edit updates the firm name; use ⋮ to
        activate or deactivate. Assign people from Members.
      </p>

      {error && <p className={styles.formError}>{error}</p>}

      {editFirmForm && (
        <div className={`${styles.skAddMemberCard} ${styles.skEditUserCard}`}>
          <h3 className={styles.skSubheading}>
            Edit firm — {editFirmForm.label}
          </h3>
          <form className={styles.skRoleForm} onSubmit={(e) => void saveEditFirm(e)}>
            <div className={styles.skRoleFormGrid}>
              <input
                className={styles.filterInput}
                placeholder="Firm name"
                value={editFirmForm.name}
                onChange={(e) =>
                  setEditFirmForm((f) => (f ? { ...f, name: e.target.value } : f))
                }
                required
              />
            </div>
            <div className={styles.skAddMemberFormActions}>
              <button
                type="button"
                className={styles.skSmallBtn}
                onClick={() => setEditFirmForm(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={busyId === editFirmForm.id}
              >
                {busyId === editFirmForm.id ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddFirmForm && (
        <div className={styles.skAddMemberCard}>
          <h3 className={styles.skSubheading}>Add firm</h3>
          <form
            className={styles.skRoleForm}
            onSubmit={(e) => void handleCreateTeam(e)}
          >
            <div className={styles.skRoleFormGrid}>
              <input
                type="text"
                placeholder="Firm name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={styles.filterInput}
                required
              />
            </div>
            <div className={styles.skAddMemberFormActions}>
              <button
                type="button"
                className={styles.skSmallBtn}
                onClick={() => setShowAddFirmForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={busyId === "create-firm"}
              >
                {busyId === "create-firm" ? "Creating…" : "Create firm"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.skPanelBody}>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Firm</th>
                <th>People</th>
                <th>Created</th>
                <th>Status</th>
                <th>Usage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.skEmptyCell}>
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
                    <td>{formatCreatedAt(team.createdAt)}</td>
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
                      <div className={styles.skMemberActions}>
                        <button
                          type="button"
                          className={styles.skSmallBtn}
                          disabled={busyId === team.id}
                          onClick={() => {
                            setShowAddFirmForm(false);
                            setEditFirmForm(editFormFromFirm(team));
                            setSelectedTeamId(team.id);
                          }}
                        >
                          Edit
                        </button>
                        <FirmKebabMenu
                          busy={busyId === team.id}
                          active={team.active}
                          onToggleActive={() => void toggleTeamActive(team)}
                        />
                      </div>
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
