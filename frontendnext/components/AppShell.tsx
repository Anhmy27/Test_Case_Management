"use client";

import type { ReactNode, RefObject } from "react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";

export type AppShellNavItem = {
  key: string;
  label: string;
  /** Optional group label shown as a section header in the sidebar */
  group?: string;
};

type AppShellProps = {
  brand: { title: string; subtitle?: string };
  user: { name: string; email?: string; role?: string };
  navItems: ReadonlyArray<AppShellNavItem>;
  activeKey: string;
  onNavChange: (key: string) => void;
  onLogout?: () => void;
  topbar?: ReactNode;
  /** Extra slot rendered above the user card at the bottom of the sidebar */
  bottomSlot?: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

// ─── Icons (inline SVG per nav key, no external dep) ───────────────────────

const NAV_ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  projects: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  "issue-types": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  groups: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "test-cases": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  "test-cases-history": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  versions: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  "test-plans": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "test-runs-execution": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  "audit-log": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "jira-bug-log": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "jira-profile": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5.5 20.5a6.5 6.5 0 0113 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 8l1.5 1.5L21 7" />
    </svg>
  ),
  "my-test-plans": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  "running-tests": (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  history: (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const LogoutIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

export default function AppShell({
  brand,
  user,
  navItems,
  activeKey,
  onNavChange,
  onLogout,
  topbar,
  bottomSlot,
  mainRef,
  children,
}: AppShellProps) {
  const groups = navItems.reduce<{ label: string; items: AppShellNavItem[] }[]>(
    (acc, item) => {
      const g = item.group ?? "";
      const existing = acc.find((x) => x.label === g);
      if (existing) {
        existing.items.push(item);
      } else {
        acc.push({ label: g, items: [item] });
      }
      return acc;
    },
    [],
  );

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full">
        <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center gap-3 px-5 py-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-semibold tracking-tight text-white select-none dark:bg-zinc-100 dark:text-zinc-900">
              TCM
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {brand.title}
              </div>
              {brand.subtitle && (
                <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {brand.subtitle}
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            {groups.map((group, gi) => (
              <div key={group.label || gi} className={gi > 0 ? "mt-6" : ""}>
                {group.label && (
                  <div className="mb-2 px-2 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeKey === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onNavChange(item.key)}
                        className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border-l-[3px] py-2 pl-2 pr-2.5 text-left text-[13px] transition-colors ${
                          isActive
                            ? "border-l-blue-600 bg-white font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-200/80 dark:border-l-blue-400 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-600/70"
                            : "border-l-transparent font-medium text-zinc-600 hover:border-l-zinc-300 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-l-zinc-600 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                        }`}
                      >
                        <span
                          className={`shrink-0 ${
                            isActive
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {NAV_ICONS[item.key] ?? (
                            <span className="inline-block h-4 w-4 rounded-full border border-current opacity-40" />
                          )}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800">
            {bottomSlot}
            <div className="px-4 py-3">
              <ThemeToggle className="w-full justify-center" />
            </div>
            <div className="flex items-center gap-3 px-4 pb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700 select-none dark:bg-zinc-800 dark:text-zinc-200">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name}
                </div>
                {user.email && (
                  <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </div>
                )}
              </div>
              {user.role && (
                <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {user.role}
                </span>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="shrink-0 cursor-pointer rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <LogoutIcon />
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
            <div className="min-h-[52px] px-6 py-2">{topbar}</div>
          </header>
          <main ref={mainRef} className="flex-1 overflow-y-auto bg-zinc-50 px-6 py-5 dark:bg-zinc-950">
            <div className="mx-auto w-full max-w-[1360px] space-y-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
