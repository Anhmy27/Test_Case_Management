"use client";

import type { ReactNode, RefObject } from "react";

export type AppShellNavItem = {
  key: string;
  label: string;
};

type AppShellProps = {
  brand: {
    title: string;
    subtitle?: string;
  };
  user: {
    name: string;
    email?: string;
    role?: string;
  };
  navItems: ReadonlyArray<AppShellNavItem>;
  activeKey: string;
  onNavChange: (key: string) => void;
  topbar?: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export default function AppShell({
  brand,
  user,
  navItems,
  activeKey,
  onNavChange,
  topbar,
  mainRef,
  children,
}: AppShellProps) {
  return (
    <div className="h-screen overflow-hidden bg-[var(--app-bg)] text-slate-900">
      <div className="flex h-full">
        <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-slate-200/80 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                  TCM
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {brand.title}
                  </div>
                  {brand.subtitle && (
                    <div className="text-xs text-slate-500">
                      {brand.subtitle}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 px-6 py-5">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">
                  {user.name}
                </div>
                {user.email && (
                  <div className="text-xs text-slate-500">{user.email}</div>
                )}
                {user.role && (
                  <span className="mt-2 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
                    {user.role}
                  </span>
                )}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-6">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavChange(item.key)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                      activeKey === item.key
                        ? "bg-slate-900 text-white shadow"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{item.label}</span>
                    {activeKey === item.key && (
                      <span className="text-xs font-medium text-slate-200">
                        Active
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur">
            <div className="min-h-[84px] px-8 py-4">{topbar}</div>
          </header>
          <main ref={mainRef} className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
