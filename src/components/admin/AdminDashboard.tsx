"use client";

import Link from "next/link";
import type { Stats, Template, Term } from "@/types";
import { AdminSidebarFooter } from "./AdminSidebarFooter";
import { AdminTermPanel } from "./AdminTermPanel";
import { AdminTemplatePanel } from "./AdminTemplatePanel";
import { AdminFeedbackPanel } from "./AdminFeedbackPanel";
import { AdminDemoRequestsPanel } from "./AdminDemoRequestsPanel";
import styles from "@/app/admin.module.css";

function formatNumber(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface AdminDashboardProps {
  stats: Stats;
  terms: Term[];
  templates: Template[];
}

export function AdminDashboard({ stats, terms, templates }: AdminDashboardProps) {
  return (
    <div className={styles.adminWrap}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.sidebarLogo}>
          <div className={styles.logoIcon}>🏛</div>
          Nagarik Palika
          <span className={styles.adminBadge}>Admin</span>
        </Link>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>Overview</div>
          <button type="button" className={`${styles.navItem} ${styles.navItemActive}`}>
            <span className="icon">📊</span> Dashboard
          </button>
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

        <AdminSidebarFooter />
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1>Content management</h1>
        </div>

        <div className={styles.content}>
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
        </div>
      </div>
    </div>
  );
}
