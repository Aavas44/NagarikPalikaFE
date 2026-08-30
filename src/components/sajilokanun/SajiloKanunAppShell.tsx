"use client";

import { useEffect, useState, type CSSProperties, type ReactNode, type SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { UserNav } from "@/components/user/UserNav";
import { UserFooter } from "@/components/user/UserFooter";
import {
  fetchSajiloKanunMe,
  fetchSajiloKanunUsage,
  getSkRoleFromToken,
  getSkTeamIdFromToken,
  logoutSajiloKanun,
  type SajiloKanunUser,
} from "@/lib/sajilokanun-access";
import {
  formatTokenCount,
  SAJILO_KANUN_USAGE_UPDATED_EVENT,
} from "@/lib/sajilokanun/token-usage";
import pageStyles from "@/app/user.module.css";
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

const DASHBOARD = "/sajilokanun/dashboard";
const CHAT = "/sajilokanun/chat";
const CASES = "/sajilokanun/cases";
const TEAM = "/sajilokanun/team";
const USAGE = "/sajilokanun/usage";
const UNICODE = "/sajilokanun/unicode-converter";

type TabId = "dashboard" | "chat" | "cases" | "team" | "usage" | "convert";

function Icon({
  name,
  ...props
}: {
  name: TabId | "new" | "logout";
} & SVGProps<SVGSVGElement>) {
  const common = {
    width: 13,
    height: 13,
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
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
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
  const [tokenRole, setTokenRole] = useState<SajiloKanunUser["role"]>(null);
  const [tokenTeamId, setTokenTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetchSajiloKanunMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setTokenRole(getSkRoleFromToken());
    setTokenTeamId(getSkTeamIdFromToken());
  }, []);

  const role = user?.role ?? tokenRole;
  const isCaseUser = role === "caseUser";
  // JWT teamId after mount so Dashboard doesn't flicker while /me reloads —
  // never read localStorage during SSR/hydration.
  const isFirmUser = Boolean(user?.teamId ?? tokenTeamId) && !isCaseUser;

  useEffect(() => {
    if (!isCaseUser) return;
    const blocked =
      pathname.startsWith(DASHBOARD) ||
      pathname.startsWith(CHAT) ||
      pathname.startsWith(USAGE) ||
      pathname.startsWith(UNICODE) ||
      pathname.startsWith(TEAM);
    if (blocked) {
      router.replace(CASES);
    }
  }, [isCaseUser, pathname, router]);

  useEffect(() => {
    if (!user) return;
    if (!isFirmUser && pathname.startsWith(DASHBOARD)) {
      router.replace(CHAT);
    }
  }, [user, isFirmUser, pathname, router]);

  useEffect(() => {
    if (isCaseUser) {
      setBillableTokens(null);
      return;
    }
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
  }, [isCaseUser]);

  const tabs: { href: string; id: TabId; label: string }[] = isCaseUser
    ? [{ href: CASES, id: "cases", label: msg.sajilokanun.casesNav }]
    : [
        ...(isFirmUser
          ? [
              {
                href: DASHBOARD,
                id: "dashboard" as const,
                label: msg.sajilokanun.dashboardNav,
              },
            ]
          : []),
        { href: CHAT, id: "chat", label: msg.sajilokanun.chat },
        { href: CASES, id: "cases", label: msg.sajilokanun.casesNav },
        ...(role === "admin"
          ? [{ href: TEAM, id: "team" as const, label: msg.sajilokanun.teamNav }]
          : []),
        { href: USAGE, id: "usage", label: msg.sajilokanun.usageNavShort },
        { href: UNICODE, id: "convert", label: msg.sajilokanun.converterShort },
      ];

  function isActive(href: string) {
    if (href === DASHBOARD || href === CHAT) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
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
        <div className={styles.appInner}>
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
                  {(subtitle || user?.teamName || user?.name) && (
                    <p>
                      {subtitle ? (
                        <>
                          {subtitle}
                          {user?.teamName ? (
                            <span className={styles.firmPill}>{user.teamName}</span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {user?.teamName ? (
                            <span className={styles.firmPill}>{user.teamName}</span>
                          ) : null}
                          {user?.name && !user?.teamName ? user.name : null}
                        </>
                      )}
                      {role ? <span className={styles.rolePill}>{role}</span> : null}
                    </p>
                  )}
                </div>
              </header>
            )}

            <nav
              className={styles.navTabs}
              aria-label="Sajilo Kanun"
              style={
                {
                  ["--nav-cols"]: String(Math.max(tabs.length, 1)),
                  ["--nav-mobile-cols"]: String(
                    tabs.length <= 3 ? Math.max(tabs.length, 1) : 3
                  ),
                } as CSSProperties
              }
            >
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
                  onClick={(e) => {
                    // While viewing a case detail on /cases?case=…, Cases should
                    // return to the full listing (same path, no query).
                    if (tab.id === "cases" && pathname.startsWith(CASES)) {
                      e.preventDefault();
                      router.push(CASES);
                      window.dispatchEvent(
                        new Event("sajilo-kanun:show-cases-list")
                      );
                    }
                  }}
                >
                  <Icon name={tab.id} className={styles.navTabIcon} />
                  <span className={styles.navTabLabel}>{tab.label}</span>
                  {tab.id === "usage" && !isCaseUser ? (
                    <span
                      className={`${styles.navTabMeta} ${
                        billableTokens == null ? styles.navTabMetaPlaceholder : ""
                      }`}
                    >
                      {billableTokens != null ? formatTokenCount(billableTokens) : "—"}
                    </span>
                  ) : null}
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
