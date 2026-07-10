"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/user/LanguageToggle";

type AppHeaderProps = {
  actions?: ReactNode;
};

const CHAT_BASE = "/sajilokanun/chat";
const UNICODE_BASE = "/sajilokanun/unicode-converter";

export function AppHeader({ actions }: AppHeaderProps) {
  const pathname = usePathname();
  const { msg } = useLanguage();

  const navItems = [
    { href: CHAT_BASE, label: msg.sajilokanun.chat, shortLabel: msg.sajilokanun.chat },
    {
      href: UNICODE_BASE,
      label: msg.sajilokanun.unicodeConverter,
      shortLabel: msg.sajilokanun.converterShort,
    },
  ] as const;

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Link href={CHAT_BASE} className="flex min-w-0 shrink items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-base sm:h-10 sm:w-10 sm:text-lg">
              ⚖️
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                {msg.nav.sajiloKanun}
              </h1>
              <p className="hidden truncate text-xs text-[var(--muted)] sm:block">
                {msg.sajilokanun.subtitle}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== CHAT_BASE && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <LanguageToggle />
          {actions}
        </div>
      </div>

      <nav className="flex gap-1.5 border-t border-[var(--border)] px-3 py-2 sm:hidden">
        {navItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== CHAT_BASE && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-lg px-2 py-2.5 text-center text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]"
              }`}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
