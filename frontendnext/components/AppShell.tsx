"use client";

import type { ReactNode, RefObject } from "react";

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
  // Group nav items by their `group` field, preserving insertion order
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
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="flex h-full">

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-950">

          {/* Brand */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-5 py-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white select-none">
              TCM
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {brand.title}
              </div>
              {brand.subtitle && (
                <div className="truncate text-[11px] text-slate-500">
                  {brand.subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {groups.map((group, gi) => (
              <div key={group.label || gi} className={gi > 0 ? "mt-5" : ""}>
                {group.label && (
                  <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
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
                        onClick={() => onNavChange(item.key)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-blue-600/20 text-blue-300"
                            : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                        }`}
                      >
                        <span
                          className={`shrink-0 ${isActive ? "text-blue-400" : "text-slate-600"}`}
                        >
                          {NAV_ICONS[item.key] ?? (
                            <span className="inline-block h-4 w-4 rounded-full border border-current opacity-50" />
                          )}
                        </span>
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Bottom: optional slot + user card */}
          <div className="shrink-0 border-t border-slate-800">
            {bottomSlot}
            <div className="flex items-center gap-3 px-4 py-4">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200 select-none">
                {getInitials(user.name)}
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-200">
                  {user.name}
                </div>
                {user.email && (
                  <div className="truncate text-[11px] text-slate-500">
                    {user.email}
                  </div>
                )}
              </div>
              {/* Role badge */}
              {user.role && (
                <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {user.role}
                </span>
              )}
              {/* Logout */}
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Đăng xuất"
                  className="shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-800 hover:text-slate-300"
                >
                  <LogoutIcon />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
            <div className="min-h-[72px] px-6 py-4">{topbar}</div>
          </header>
          {/* Content */}
          <main ref={mainRef} className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>

      </div>
    </div>
  );
}
