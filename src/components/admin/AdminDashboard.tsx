"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Stats, Template, Term } from "@/types";
import { fetchCurrentUser } from "@/lib/auth";
import { AdminSidebarFooter } from "./AdminSidebarFooter";
import { AdminTermPanel } from "./AdminTermPanel";
import { AdminTemplatePanel } from "./AdminTemplatePanel";
import { AdminFeedbackPanel } from "./AdminFeedbackPanel";
import { AdminDemoRequestsPanel } from "./AdminDemoRequestsPanel";
import { AdminSajiloKanunPanel } from "./AdminSajiloKanunPanel";
import { AdminSajiloKanunRequestsPanel } from "./AdminSajiloKanunRequestsPanel";
import { AdminGeminiKeysPanel } from "./AdminGeminiKeysPanel";
import { AdminWardOperatorsPanel } from "./AdminWardOperatorsPanel";
import { AdminWardTemplatesPanel } from "./AdminWardTemplatesPanel";
import { AdminSajiloKanunTemplatesPanel } from "./AdminSajiloKanunTemplatesPanel";
import styles from "@/app/admin.module.css";

type AdminSection =
  | "firms"
  | "usage"
  | "roles"
  | "members"
  | "gemini-keys"
  | "sajilo-kanun-templates"
  | "ward-operators"
  | "ward-templates"
  | null;

function hashToAdminSection(hash: string): AdminSection {
  switch (hash.replace(/^#/, "")) {
    case "sajilo-kanun-teams":
    case "sajilo-kanun-firms":
      return "firms";
    case "sajilo-kanun-requests":
    case "sajilo-kanun-usage":
      return "usage";
    case "sajilo-kanun-roles":
      return "roles";
    case "sajilo-kanun-members":
      return "members";
    case "sajilo-kanun-gemini-keys":
      return "gemini-keys";
    case "sajilo-kanun-templates":
      return "sajilo-kanun-templates";
    case "ward-operators":
      return "ward-operators";
    case "ward-templates":
      return "ward-templates";
    default:
      return null;
  }
}

function formatNumber(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function navClass(active: boolean) {
  return active
    ? `${styles.navItemLink} ${styles.navItemLinkActive}`
    : styles.navItemLink;
}

interface AdminDashboardProps {
  stats: Stats;
  terms: Term[];
  templates: Template[];
  loadError?: string | null;
}

export function AdminDashboard({
  stats,
  terms,
  templates,
  loadError = null,
}: AdminDashboardProps) {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminSection, setAdminSection] = useState<AdminSection>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        setIsPlatformAdmin(
          user?.userType === "superadmin" || user?.userType === "admin"
        );
        setIsSuperadmin(user?.userType === "superadmin");
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const sync = () => setAdminSection(hashToAdminSection(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  function goToSection(
    event: React.MouseEvent<HTMLElement>,
    hash: string
  ) {
    event.preventDefault();
    const nextHash = `#${hash}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
    setAdminSection(hashToAdminSection(hash));
  }

  const topbarTitle =
    adminSection === "firms"
      ? "Sajilo Kanun — Firms"
      : adminSection === "usage"
        ? "Sajilo Kanun — Token usage"
        : adminSection === "roles"
          ? "Sajilo Kanun — Roles"
          : adminSection === "members"
            ? "Sajilo Kanun — Members"
            : adminSection === "gemini-keys"
              ? "Sajilo Kanun — Gemini keys"
              : adminSection === "sajilo-kanun-templates"
                ? "Sajilo Kanun — Document templates"
                : adminSection === "ward-operators"
                ? "Ward — Operators"
                : adminSection === "ward-templates"
                  ? "Ward — Document templates"
                  : "Content management";

  return (
    <div className={styles.adminWrap}>
      <aside className={styles.sidebar}>
        <Link
          href="/admin"
          className={styles.sidebarLogo}
          onClick={() => {
            if (window.location.hash) {
              window.history.replaceState(null, "", "/admin");
              setAdminSection(null);
            }
          }}
        >
          <div className={styles.logoIcon}>🏛</div>
          Nagarik Palika
          <span className={styles.adminBadge}>Admin</span>
        </Link>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Overview</div>
          <Link
            href="/admin"
            className={navClass(adminSection === null)}
            onClick={() => {
              if (window.location.hash) {
                window.history.replaceState(null, "", "/admin");
                setAdminSection(null);
              }
            }}
          >
            <span className="icon">📊</span> Dashboard
          </Link>
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Content</div>
          <a href="#terminology" className={styles.navItemLink}>
            <span className="icon">📖</span> Terminology{" "}
            <span className={styles.countBadge}>{terms.length}</span>
          </a>
          <a href="#templates" className={styles.navItemLink}>
            <span className="icon">📄</span> Templates{" "}
            <span className={styles.countBadge}>{templates.length}</span>
          </a>
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Community</div>
          <a href="#feedback" className={styles.navItemLink}>
            <span className="icon">💬</span> Feedback
          </a>
          <a href="#demo-requests" className={styles.navItemLink}>
            <span className="icon">⚖️</span> Sajilo Kanun demos
          </a>
        </div>

        {isPlatformAdmin && (
          <div className={styles.navGroup}>
            <div className={styles.navLabel}>Sajilo Kanun</div>
            <button
              type="button"
              className={navClass(adminSection === "firms")}
              onClick={(event) => goToSection(event, "sajilo-kanun-firms")}
            >
              <span className="icon">🏢</span> Firms
            </button>
            <button
              type="button"
              className={navClass(adminSection === "usage")}
              onClick={(event) => goToSection(event, "sajilo-kanun-usage")}
            >
              <span className="icon">📊</span> Token usage
            </button>
            <button
              type="button"
              className={navClass(adminSection === "roles")}
              onClick={(event) => goToSection(event, "sajilo-kanun-roles")}
            >
              <span className="icon">🔐</span> Roles
            </button>
            <button
              type="button"
              className={navClass(adminSection === "members")}
              onClick={(event) => goToSection(event, "sajilo-kanun-members")}
            >
              <span className="icon">👥</span> Members
            </button>
            {isSuperadmin ? (
              <>
                <button
                  type="button"
                  className={navClass(adminSection === "gemini-keys")}
                  onClick={(event) =>
                    goToSection(event, "sajilo-kanun-gemini-keys")
                  }
                >
                  <span className="icon">🔑</span> Gemini keys
                </button>
                <button
                  type="button"
                  className={navClass(adminSection === "sajilo-kanun-templates")}
                  onClick={(event) =>
                    goToSection(event, "sajilo-kanun-templates")
                  }
                >
                  <span className="icon">📝</span> SK templates
                </button>
              </>
            ) : null}
          </div>
        )}

        {isSuperadmin ? (
          <div className={styles.navGroup}>
            <div className={styles.navLabel}>Ward office</div>
            <button
              type="button"
              className={navClass(adminSection === "ward-operators")}
              onClick={(event) => goToSection(event, "ward-operators")}
            >
              <span className="icon">🏘️</span> Ward operators
            </button>
            <button
              type="button"
              className={navClass(adminSection === "ward-templates")}
              onClick={(event) => goToSection(event, "ward-templates")}
            >
              <span className="icon">📝</span> Ward templates
            </button>
          </div>
        ) : null}

        <AdminSidebarFooter />
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1>{topbarTitle}</h1>
        </div>

        <div className={styles.content}>
          {loadError ? (
            <p className={styles.formError} style={{ margin: "0 0 1rem" }}>
              Could not load admin data from the API ({loadError}). If the backend
              just started, refresh the page.
            </p>
          ) : null}
          {adminSection === null ? (
            <>
              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <div className={styles.metricVal} style={{ color: "#185FA5" }}>
                    {stats.termsCount}
                  </div>
                  <div className={styles.metricLabel}>Total terms</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricVal} style={{ color: "#3B6D11" }}>
                    {stats.templatesCount}
                  </div>
                  <div className={styles.metricLabel}>Templates</div>
                </div>
                <div className={styles.metric}>
                  <div className={styles.metricVal} style={{ color: "#854F0B" }}>
                    {formatNumber(stats.monthlySearches)}
                  </div>
                  <div className={styles.metricLabel}>Monthly searches</div>
                </div>
              </div>

              <AdminTermPanel initialTerms={terms} />
              <AdminTemplatePanel initialTemplates={templates} />
              <AdminFeedbackPanel />
              <AdminDemoRequestsPanel />
            </>
          ) : !authChecked ? (
            <p className={styles.panelDesc}>Loading…</p>
          ) : adminSection === "gemini-keys" ? (
            isSuperadmin ? (
              <AdminGeminiKeysPanel />
            ) : (
              <p className={styles.formError}>
                Superadmin access is required to manage Gemini API keys.
              </p>
            )
          ) : adminSection === "sajilo-kanun-templates" ? (
            isSuperadmin ? (
              <AdminSajiloKanunTemplatesPanel />
            ) : (
              <p className={styles.formError}>
                Superadmin access is required to manage Sajilo Kanun templates.
              </p>
            )
          ) : adminSection === "ward-operators" ? (
            isSuperadmin ? (
              <AdminWardOperatorsPanel />
            ) : (
              <p className={styles.formError}>
                Superadmin access is required to manage ward operators.
              </p>
            )
          ) : adminSection === "ward-templates" ? (
            isSuperadmin ? (
              <AdminWardTemplatesPanel />
            ) : (
              <p className={styles.formError}>
                Superadmin access is required to manage ward templates.
              </p>
            )
          ) : isPlatformAdmin && adminSection === "usage" ? (
            <AdminSajiloKanunRequestsPanel />
          ) : isPlatformAdmin &&
            (adminSection === "firms" ||
              adminSection === "roles" ||
              adminSection === "members") ? (
            <AdminSajiloKanunPanel section={adminSection} />
          ) : (
            <p className={styles.formError}>
              Platform admin access is required for Sajilo Kanun management.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
