"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  adminCreateGeminiKey,
  adminDeleteGeminiKey,
  adminFetchGeminiKeys,
  adminTestGeminiKey,
  adminUpdateGeminiKey,
  type GeminiApiKeyRecord,
  type GeminiApiKeyRole,
} from "@/lib/sajilokanun-access";
import styles from "@/app/admin.module.css";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function roleLabel(role: GeminiApiKeyRole) {
  if (role === "default") return "Default";
  if (role === "fallback") return "Fallback";
  return "Pool";
}

function RoleBadge({ role }: { role: GeminiApiKeyRole }) {
  const tone =
    role === "default"
      ? styles.geminiRoleDefault
      : role === "fallback"
        ? styles.geminiRoleFallback
        : styles.geminiRolePool;
  return <span className={`${styles.geminiRoleBadge} ${tone}`}>{roleLabel(role)}</span>;
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 16.9 6.8 19.7l1-5.8L3.5 9.7l5.9-.9L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FallbackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h10M14 12l-3-3M14 12l-3 3M20 6v12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 12.5l2 2 4.5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.4M9.9 5.1A10.5 10.5 0 0121.5 12c-.6 1.1-1.4 2.1-2.3 2.9M6.1 6.1C4.7 7.2 3.5 8.5 2.5 12c1.6 4.4 5.9 7.5 10.9 7.5 1.4 0 2.7-.3 3.9-.7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12.5C3.4 8.1 7.7 5 12.7 5S22 8.1 23.4 12.5C22 16.9 17.7 20 12.7 20S3.4 16.9 2 12.5z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12.7" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function GeminiKeyKebabMenu({
  busy,
  item,
  onTest,
  onSetRole,
  onToggleActive,
  onDelete,
}: {
  busy: boolean;
  item: GeminiApiKeyRecord;
  onTest: () => void;
  onSetRole: (role: GeminiApiKeyRole) => void;
  onToggleActive: () => void;
  onDelete: () => void;
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
    const menuWidth = 200;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferUp = spaceBelow < 260 && spaceAbove > spaceBelow;
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

  const menu =
    open && menuPos
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
            <div className={styles.skKebabMenuScroll}>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onTest)}
              >
                <span className={styles.skKebabItemLabel}>
                  <TestIcon />
                  Test key
                </span>
              </button>

              <div className={styles.skKebabDivider} />
              <p className={styles.skKebabSection}>Role</p>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy || item.role === "default"}
                onClick={() => runAndClose(() => onSetRole("default"))}
              >
                <span className={styles.skKebabItemLabel}>
                  <StarIcon />
                  Set as default
                </span>
                {item.role === "default" ? (
                  <span className={styles.skKebabItemMeta}>Current</span>
                ) : null}
              </button>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy || item.role === "fallback"}
                onClick={() => runAndClose(() => onSetRole("fallback"))}
              >
                <span className={styles.skKebabItemLabel}>
                  <FallbackIcon />
                  Set as fallback
                </span>
                {item.role === "fallback" ? (
                  <span className={styles.skKebabItemMeta}>Current</span>
                ) : null}
              </button>
              {item.role !== "pool" ? (
                <button
                  type="button"
                  className={styles.skKebabItem}
                  role="menuitem"
                  disabled={busy}
                  onClick={() => runAndClose(() => onSetRole("pool"))}
                >
                  Clear role
                </button>
              ) : null}

              <div className={styles.skKebabDivider} />
              <p className={styles.skKebabSection}>Status</p>
              <button
                type="button"
                className={styles.skKebabItem}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onToggleActive)}
              >
                {item.active ? "Deactivate" : "Activate"}
              </button>

              <div className={styles.skKebabDivider} />
              <button
                type="button"
                className={`${styles.skKebabItem} ${styles.skKebabItemDanger}`}
                role="menuitem"
                disabled={busy}
                onClick={() => runAndClose(onDelete)}
              >
                Delete key
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={styles.skKebabWrap} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.skKebabBtn}
        disabled={busy}
        aria-label="More key actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {menu}
    </div>
  );
}

export function AdminGeminiKeysPanel() {
  const [keys, setKeys] = useState<GeminiApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [errorPopup, setErrorPopup] = useState<{
    label: string;
    error: string;
    at: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await adminFetchGeminiKeys();
      setKeys(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await adminFetchGeminiKeys();
        if (!cancelled) setKeys(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load keys");
        setKeys([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!errorPopup) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setErrorPopup(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [errorPopup]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) return;
    setAdding(true);
    setError("");
    try {
      await adminCreateGeminiKey({
        label: label.trim(),
        apiKey: apiKey.trim(),
      });
      setLabel("");
      setApiKey("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add key");
    } finally {
      setAdding(false);
    }
  }

  async function syncFromEnv() {
    setAdding(true);
    setError("");
    try {
      const { getToken } = await import("@/lib/auth");
      const token = getToken();
      if (!token) throw new Error("Not signed in");
      // Next.js strips Authorization on some App Router handlers — use custom header.
      const res = await fetch("/api/sajilokanun/gemini-keys/sync-env", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nagarik-token": token,
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to sync env keys");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync env keys");
    } finally {
      setAdding(false);
    }
  }

  async function setRole(id: string, nextRole: GeminiApiKeyRole) {
    setBusyId(id);
    setError("");
    try {
      await adminUpdateGeminiKey(id, { setRole: nextRole });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(item: GeminiApiKeyRecord) {
    setBusyId(item.id);
    setError("");
    try {
      await adminUpdateGeminiKey(item.id, { active: !item.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this Gemini API key?")) return;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await adminDeleteGeminiKey(id);
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTest(item: GeminiApiKeyRecord) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const result = await adminTestGeminiKey(item.id);
      setKeys((prev) =>
        prev.map((row) => (row.id === result.key.id ? { ...result.key, apiKey: undefined } : row))
      );
      if (result.ok) {
        setNotice(
          `“${result.label}” works (${result.latencyMs} ms).`
        );
      } else {
        setError(
          `“${result.label}” failed (${result.latencyMs} ms): ${
            result.error ?? "Unknown error"
          }`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReveal(id: string) {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const list = await adminFetchGeminiKeys({ revealId: id });
      const found = list.find((k) => k.id === id);
      if (found?.apiKey) {
        setRevealed((prev) => ({ ...prev, [id]: found.apiKey! }));
      }
      setKeys(list.map((k) => ({ ...k, apiKey: undefined })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal key");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="sajilo-kanun-gemini-keys" className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2>Gemini API keys</h2>
        <div className={styles.panelHeaderActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={adding || loading}
            onClick={() => void syncFromEnv()}
            title="Upsert GEMINI_API_KEY and GEMINI_API_KEY_FALLBACK from frontend/.env.local"
          >
            Import from env
          </button>
        </div>
      </div>
      <p className={styles.panelDesc}>
        On 429 and other retryable errors, rotation order is{" "}
        <strong>Default → other active pool keys → Fallback</strong>.{" "}
        <strong>Import from env</strong> upserts{" "}
        <code>GEMINI_API_KEY</code> (default) and{" "}
        <code>GEMINI_API_KEY_FALLBACK</code> (fallback) from{" "}
        <code>frontend/.env.local</code>.
      </p>

      {error ? <p className={styles.formError}>{error}</p> : null}
      {notice ? (
        <p className={styles.panelDesc} style={{ color: "#027a48", fontWeight: 600 }}>
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={handleAdd}
        className={styles.formRow}
        style={{ marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}
      >
        <input
          className={styles.filterSelect}
          style={{ minWidth: "10rem", flex: "1 1 8rem" }}
          placeholder="Label (e.g. Studio key 2)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          disabled={adding}
          required
        />
        <input
          className={styles.filterSelect}
          style={{ minWidth: "14rem", flex: "2 1 14rem" }}
          placeholder="Paste GEMINI_API_KEY"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={adding}
          required
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className={styles.btnPrimary} disabled={adding}>
          {adding ? "Adding…" : "Add key"}
        </button>
      </form>

      {loading ? (
        <p className={styles.panelDesc}>Loading…</p>
      ) : keys.length === 0 ? (
        <p className={styles.panelDesc}>
          No keys in the pool yet. Add one above, or call Gemini once so env keys
          can bootstrap automatically.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last used</th>
                <th>Last error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((item) => {
                const busy = busyId === item.id;
                const isRevealed = Boolean(revealed[item.id]);
                const shown = revealed[item.id] ?? item.maskedKey;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.label}</strong>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <code
                          style={{
                            fontSize: "12px",
                            wordBreak: "break-all",
                            flex: 1,
                          }}
                        >
                          {shown}
                        </code>
                        <button
                          type="button"
                          className={styles.skKebabBtn}
                          disabled={busy}
                          title={isRevealed ? "Hide key" : "Reveal key"}
                          aria-label={isRevealed ? "Hide key" : "Reveal key"}
                          onClick={() => void handleReveal(item.id)}
                        >
                          <EyeIcon open={isRevealed} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={item.role} />
                    </td>
                    <td>{item.active ? "Active" : "Inactive"}</td>
                    <td>{formatDate(item.lastUsedAt)}</td>
                    <td>
                      {item.lastError ? (
                        <button
                          type="button"
                          className={styles.geminiErrorLink}
                          onClick={() =>
                            setErrorPopup({
                              label: item.label,
                              error: item.lastError,
                              at: item.lastErrorAt,
                            })
                          }
                        >
                          View error
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <GeminiKeyKebabMenu
                        busy={busy}
                        item={item}
                        onTest={() => void handleTest(item)}
                        onSetRole={(role) => void setRole(item.id, role)}
                        onToggleActive={() => void toggleActive(item)}
                        onDelete={() => void handleDelete(item.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {errorPopup ? (
        <div
          className={styles.geminiErrorOverlay}
          role="presentation"
          onClick={() => setErrorPopup(null)}
        >
          <div
            className={styles.geminiErrorPopup}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gemini-error-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.geminiErrorPopupHeader}>
              <h3 id="gemini-error-title">Error — {errorPopup.label}</h3>
              <button
                type="button"
                className={styles.skKebabBtn}
                aria-label="Close"
                onClick={() => setErrorPopup(null)}
              >
                ×
              </button>
            </div>
            {errorPopup.at ? (
              <p className={styles.geminiErrorMeta}>{formatDate(errorPopup.at)}</p>
            ) : null}
            <pre className={styles.geminiErrorBody}>{errorPopup.error}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
