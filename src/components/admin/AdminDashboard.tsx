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
import styles from "@/app/admin.module.css";

type SajiloSection = "firms" | "roles" | "members" | null;

function hashToSajiloSection(hash: string): SajiloSection {
  switch (hash.replace(/^#/, "")) {
    case "sajilo-kanun-teams":
    case "sajilo-kanun-firms":
      return "firms";
    case "sajilo-kanun-roles":
      return "roles";
    case "sajilo-kanun-members":
      return "members";
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
}

export function AdminDashboard({ stats, terms, templates }: AdminDashboardProps) {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [sajiloSection, setSajiloSection] = useState<SajiloSection>(null);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      setIsSuperadmin(user?.userType === "superadmin");
    });
  }, []);

  useEffect(() => {
    const sync = () => setSajiloSection(hashToSajiloSection(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const topbarTitle =
    sajiloSection === "firms"
      ? "Sajilo Kanun — Firms"
      : sajiloSection === "roles"
        ? "Sajilo Kanun — Roles"
        : sajiloSection === "members"
          ? "Sajilo Kanun — Members"
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
              setSajiloSection(null);
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
            className={navClass(sajiloSection === null)}
            onClick={() => {
              if (window.location.hash) {
                window.history.replaceState(null, "", "/admin");
                setSajiloSection(null);
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

        {isSuperadmin && (
          <div className={styles.navGroup}>
            <div className={styles.navLabel}>Sajilo Kanun</div>
            <a
              href="#sajilo-kanun-firms"
              className={navClass(sajiloSection === "firms")}
            >
              <span className="icon">🏢</span> Firms
            </a>
            <a
              href="#sajilo-kanun-roles"
              className={navClass(sajiloSection === "roles")}
            >
              <span className="icon">🔐</span> Roles
            </a>
            <a
              href="#sajilo-kanun-members"
              className={navClass(sajiloSection === "members")}
            >
              <span className="icon">👥</span> Members
            </a>
          </div>
        )}

        <AdminSidebarFooter />
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1>{topbarTitle}</h1>
        </div>

        <div className={styles.content}>
          {sajiloSection === null ? (
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
          ) : isSuperadmin ? (
            <AdminSajiloKanunPanel section={sajiloSection} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
