"use client";

import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import {
  fetchSajiloKanunMe,
  fetchSajiloKanunUsage,
  getSkRoleFromToken,
  logoutSajiloKanun,
  type SajiloKanunUser,
} from "@/lib/sajilokanun-access";
import {
  formatTokenCount,
  SAJILO_KANUN_USAGE_UPDATED_EVENT,
} from "@/lib/sajilokanun/token-usage";
import pageStyles from "@/app/user.module.css";
import emiStyles from "@/components/user/emi.module.css";
import styles from "./SajiloKanunAppShell.module.css";

type HeaderAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Visual variant — default is primary soft */
  variant?: "primary" | "ghost";
};

type SajiloKanunAppShellProps = {
  title: string;
  subtitle?: string;
  compact?: boolean;
  /** Contextual action in the page header (e.g. New chat) */
  headerAction?: HeaderAction | null;
  /** @deprecated prefer headerAction */
  actions?: ReactNode;
  children: ReactNode;
};

const CHAT = "/sajilokanun/chat";
const CASES = "/sajilokanun/cases";
const TEAM = "/sajilokanun/team";
const USAGE = "/sajilokanun/usage";
const UNICODE = "/sajilokanun/unicode-converter";

type TabId = "chat" | "cases" | "team" | "usage" | "convert";

function Icon({
  name,
  ...props
}: {
  name: TabId | "new" | "logout";
} & SVGProps<SVGSVGElement>) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };

  switch (name) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "cases":
      return (
        <svg {...common}>
          <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "usage":
      return (
        <svg {...common}>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "convert":
      return (
        <svg {...common}>
          <path d="M4 7h11" />
          <path d="M9 3v4" />
          <path d="M20 17H9" />
          <path d="M15 21v-4" />
          <path d="M4 12h16" />
        </svg>
      );
    case "new":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
  }
}

export function SajiloKanunAppShell({
  title,
  subtitle,
  compact = false,
  headerAction = null,
  actions,
  children,
}: SajiloKanunAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { msg } = useLanguage();
  const [user, setUser] = useState<SajiloKanunUser | null>(null);
  const [billableTokens, setBillableTokens] = useState<number | null>(null);

  useEffect(() => {
    fetchSajiloKanunMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const refresh = () => {
      fetchSajiloKanunUsage()
        .then((usage) => {
          setBillableTokens(usage.billableTokens ?? usage.totalTokens);
        })
        .catch(() => setBillableTokens(null));
    };
    refresh();
    window.addEventListener(SAJILO_KANUN_USAGE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SAJILO_KANUN_USAGE_UPDATED_EVENT, refresh);
  }, []);

  const role = user?.role ?? getSkRoleFromToken();

  const tabs: { href: string; id: TabId; label: string }[] = [
    { href: CHAT, id: "chat", label: msg.sajilokanun.chat },
    { href: CASES, id: "cases", label: "Cases" },
    ...(role === "admin" ? [{ href: TEAM, id: "team" as const, label: "Team" }] : []),
    { href: USAGE, id: "usage", label: msg.sajilokanun.usageNavShort },
    { href: UNICODE, id: "convert", label: msg.sajilokanun.converterShort },
  ];

  function isActive(href: string) {
    return pathname === href || (href !== CHAT && pathname.startsWith(href));
  }

  function handleLogout() {
    logoutSajiloKanun();
    router.push("/sajilokanun");
    router.refresh();
  }

  return (
    <>
      <UserNav />
      <section className={`${pageStyles.calculatorPage} ${styles.skAppPage}`}>
        <div className={`${pageStyles.calculatorPageInner} ${emiStyles.emiPageInner}`}>
          <div className={styles.chrome}>
            <div className={styles.chromeTop}>
              <Link href="/sajilokanun" className={styles.backLink}>
                ← {msg.nav.sajiloKanun}
              </Link>
              <div className={styles.actionCluster} role="group" aria-label="Account">
                {headerAction ? (
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionPrimary}`}
                    onClick={headerAction.onClick}
                    disabled={headerAction.disabled}
                  >
                    <Icon name="new" />
                    <span>{headerAction.label}</span>
                  </button>
                ) : null}
                {actions}
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionMuted}`}
                  onClick={handleLogout}
                >
                  <Icon name="logout" />
                  <span>{msg.sajilokanun.logout}</span>
                </button>
              </div>
            </div>

            {!compact && (
              <header className={styles.pageIntro}>
                <div className={styles.pageIntroText}>
                  <h1>{title}</h1>
                  {(subtitle || user?.teamName) && (
                    <p>
                      {subtitle ?? user?.teamName}
                      {role ? <span className={styles.rolePill}>{role}</span> : null}
                    </p>
                  )}
                </div>
              </header>
            )}

            <nav className={styles.navTabs} aria-label="Sajilo Kanun">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  title={
                    tab.id === "usage" ? msg.sajilokanun.usageLog.badgeTitle : undefined
                  }
                  className={`${styles.navTab} ${
                    isActive(tab.href) ? styles.navTabActive : ""
                  }`}
                >
                  <Icon name={tab.id} className={styles.navTabIcon} />
                  <span className={styles.navTabLabel}>{tab.label}</span>
                  {tab.id === "usage" && billableTokens != null && (
                    <span className={styles.navTabMeta}>
                      {formatTokenCount(billableTokens)}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {children}
        </div>
      </section>
      <UserFooter showContact={false} />
    </>
  );
}
