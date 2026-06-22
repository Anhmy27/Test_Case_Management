"use client";

import { useEffect, useMemo } from "react";
import type { AppShellNavItem } from "@/components/AppShell";

export const ADMIN_NAV_ITEMS: ReadonlyArray<AppShellNavItem> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "issue-types", label: "Issue Types" },
  { key: "groups", label: "Groups" },
  { key: "test-cases", label: "Test Cases" },
  { key: "test-cases-history", label: "Execution History" },
  { key: "versions", label: "Versions" },
  { key: "test-plans", label: "Test Plans" },
  { key: "test-runs-execution", label: "Test Runs + Execution" },
  { key: "jira-bug-log", label: "Jira Bug Log" },
  { key: "users", label: "Users" },
  { key: "audit-log", label: "Audit Log" },
];

const GLOBAL_SCOPE_KEYS = new Set([
  "dashboard",
  "projects",
  "issue-types",
  "users",
  "audit-log",
]);

const PROJECT_SCOPE_KEYS = new Set([
  "dashboard",
  "groups",
  "test-cases",
  "test-cases-history",
  "versions",
  "test-plans",
  "test-runs-execution",
  "jira-bug-log",
]);

export function isGlobalProjectScope(selectedProjectId: string) {
  return !String(selectedProjectId || "").trim();
}

export function getAdminNavItems(selectedProjectId: string): AppShellNavItem[] {
  const isGlobal = isGlobalProjectScope(selectedProjectId);
  const allowed = isGlobal ? GLOBAL_SCOPE_KEYS : PROJECT_SCOPE_KEYS;
  const group = isGlobal ? "Global" : "Project";
  return ADMIN_NAV_ITEMS.filter((item) => allowed.has(item.key)).map((item) => ({
    ...item,
    group,
  }));
}

export function isAdminTabAllowedForScope(tab: string, selectedProjectId: string) {
  const allowed = isGlobalProjectScope(selectedProjectId)
    ? GLOBAL_SCOPE_KEYS
    : PROJECT_SCOPE_KEYS;
  return allowed.has(tab);
}

export function useAdminSidebarNav(
  selectedProjectId: string,
  activeKey: string,
  router: { replace: (path: string) => void },
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;

  const navItems = useMemo(
    () => getAdminNavItems(selectedProjectId),
    [selectedProjectId],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (isAdminTabAllowedForScope(activeKey, selectedProjectId)) {
      return;
    }

    const fallback = getAdminNavItems(selectedProjectId)[0]?.key ?? "dashboard";
    router.replace(`/workspace/admin/${fallback}`);
  }, [activeKey, enabled, selectedProjectId, router]);

  return navItems;
}
