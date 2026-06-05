"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppShellNavItem } from "@/components/AppShell";
import { getId, matchesSelectedEntity } from "@/lib/api";

type RecordAny = Record<string, unknown>;

export const EMPLOYEE_NAV_ITEMS: ReadonlyArray<AppShellNavItem> = [
  { key: "my-test-plans", label: "My Test Plans", group: "Workspace" },
  { key: "running-tests", label: "Running Tests", group: "Workspace" },
  { key: "history", label: "History", group: "Workspace" },
  { key: "execution", label: "Run Test", group: "Workspace" },
];

const PROJECT_STORAGE_KEY = "tcm_selected_project_id";

export function getStoredProjectId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PROJECT_STORAGE_KEY) || "";
}

export function persistProjectId(projectId: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (projectId) {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
  } else {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
  }
}

export function useEmployeeProjectScope(projects: RecordAny[]) {
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    setSelectedProjectId(getStoredProjectId());
  }, []);

  useEffect(() => {
    persistProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const safeProjects = useMemo(
    () => (Array.isArray(projects) ? projects : []),
    [projects],
  );

  const selectedProject = safeProjects.find(
    (project) => getId(project) === selectedProjectId,
  );
  const hasValidProjectScope = Boolean(selectedProjectId && selectedProject);
  const effectiveProjectId = hasValidProjectScope ? selectedProjectId : "";
  const scopeLabel = selectedProject
    ? String((selectedProject as { name?: string }).name || "")
    : "All projects";
  const isGlobalScope = !effectiveProjectId;

  const filterPlans = (plans: RecordAny[]) => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (isGlobalScope) {
      return safePlans;
    }

    return safePlans.filter((plan) =>
      matchesSelectedEntity((plan as { project?: unknown }).project, effectiveProjectId),
    );
  };

  const filterRuns = (runs: RecordAny[]) => {
    const safeRuns = Array.isArray(runs) ? runs : [];
    if (isGlobalScope) {
      return safeRuns;
    }

    return safeRuns.filter((run) => {
      const typedRun = run as { project?: unknown; testPlan?: { project?: unknown } };
      return matchesSelectedEntity(
        typedRun.testPlan?.project ?? typedRun.project,
        effectiveProjectId,
      );
    });
  };

  const filterMyRuns = (runs: RecordAny[], currentUserId: string) => {
    const normalizedUserId = String(currentUserId || "").trim();
    if (!normalizedUserId) {
      return [];
    }

    return filterRuns(runs).filter(
      (run) => String(getId(run.startedBy) || "") === normalizedUserId,
    );
  };

  return {
    selectedProjectId,
    setSelectedProjectId,
    safeProjects,
    scopeLabel,
    isGlobalScope,
    effectiveProjectId,
    filterPlans,
    filterRuns,
    filterMyRuns,
  };
}

type EmployeeTopbarOptions = {
  tabLabel: string;
  tabHint?: string;
  scopeLabel: string;
  selectedProjectId: string;
  projects: RecordAny[];
  onProjectChange: (projectId: string) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  stats?: Array<{ label: string; value: number }>;
};

export function buildEmployeeTopbar({
  tabLabel,
  tabHint,
  scopeLabel,
  selectedProjectId,
  projects,
  onProjectChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search by name, code, key, status...",
  stats,
}: EmployeeTopbarOptions): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-[220px]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Workspace
        </div>
        <div className="text-xl font-semibold text-slate-900">{tabLabel}</div>
        <div className="text-sm text-slate-500">
          Scope: <span className="font-medium text-slate-700">{scopeLabel}</span>
        </div>
        {tabHint ? <div className="text-xs text-slate-400">{tabHint}</div> : null}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs font-semibold text-slate-500">Project scope</label>
          <select
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={getId(project)} value={getId(project)}>
                {String((project as { name?: string }).name || "")}
              </option>
            ))}
          </select>
        </div>
        {onSearchChange ? (
          <div className="min-w-[260px]">
            <label className="text-xs font-semibold text-slate-500">Search</label>
            <div className="relative mt-1">
              <input
                type="search"
                value={searchTerm || ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <svg
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.6 0 7.5 7.5 0 0010.6 0z"
                />
              </svg>
            </div>
          </div>
        ) : null}
        {stats?.length ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {stats.map((item) => (
              <span
                key={item.label}
                className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600"
              >
                {item.value} {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
