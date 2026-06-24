"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardScreen from "@/components/workspaceScreens/AdminDashboardScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId, userName } from "@/lib/api";
import { dashboardInputClassName } from "@/components/dashboard/chartTheme";

type RecordAny = Record<string, any>;
const PROJECT_SCOPE_STORAGE_KEY = "tcm_selected_project_id";
const PROJECT_SCOPE_TABS = new Set([
  "groups",
  "test-cases",
  "test-cases-history",
  "versions",
  "test-plans",
  "test-runs-execution",
  "jira-bug-log",
]);

export type DashboardNavigateOptions = {
  projectId?: string;
  query?: Record<string, string | undefined>;
};

export default function AdminDashboardRoute() {
  const router = useRouter();
  const { currentUser, selectedProjectId, setSelectedProjectId, setTopbar, showNotice } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);
  const [testRuns, setTestRuns] = useState<RecordAny[]>([]);
  const [versionHealth, setVersionHealth] = useState<RecordAny[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);

      try {
        const dashboardQuery = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
        const testRunsQuery = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
        const versionDashboardQuery = selectedProjectId
          ? `/api/dashboard/versions?projectId=${encodeURIComponent(selectedProjectId)}`
          : null;
        const [projectsResponse, plansResponse, dashboardResponse, testRunsResponse, versionDashboardResponse] =
          await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans"),
          apiRequest<RecordAny>(`/api/dashboard${dashboardQuery}`),
          apiRequest<{ testRuns: RecordAny[] }>(`/api/test-runs${testRunsQuery}`),
          versionDashboardQuery
            ? apiRequest<{ versions: RecordAny[] }>(versionDashboardQuery)
            : Promise.resolve({ versions: [] }),
        ]);

        if (cancelled) {
          return;
        }

        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setDashboard(dashboardResponse || null);
        setTestRuns(Array.isArray(testRunsResponse.testRuns) ? testRunsResponse.testRuns : []);
        setVersionHealth(Array.isArray(versionDashboardResponse.versions) ? versionDashboardResponse.versions : []);
      } catch (error) {
        if (!cancelled) {
          showNotice(error instanceof Error ? error.message : "Unable to load dashboard", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, showNotice]);

  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const safePlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const safeDashboard = dashboard || {};
  const dashboardSummary = safeDashboard.summary || {};
  const dashboardProjectOverview = Array.isArray(safeDashboard.projectOverview) ? safeDashboard.projectOverview : [];
  const isGlobalScope = !selectedProjectId;
  const selectedProject = safeProjects.find((project) => getId(project) === selectedProjectId) || null;
  const scopedProjectName = selectedProject?.name || "";
  const runningRunsCount = Number(dashboardSummary.runningRuns || 0);
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const handleNavigate = (tab: string, options?: string | DashboardNavigateOptions) => {
    const normalized: DashboardNavigateOptions =
      typeof options === "string" ? { projectId: options } : options ?? {};
    const explicitProjectId = normalized.projectId?.trim() || "";
    const nextProjectId = explicitProjectId || selectedProjectId;

    if (PROJECT_SCOPE_TABS.has(tab)) {
      if (!nextProjectId) {
        showNotice("Please select a project before opening this section.", "info");
        return;
      }

      setSelectedProjectId(nextProjectId);
      window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, nextProjectId);
    } else if (explicitProjectId) {
      setSelectedProjectId(explicitProjectId);
      window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, explicitProjectId);
    }

    const params = new URLSearchParams();
    Object.entries(normalized.query || {}).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.push(`/workspace/admin/${tab}${query ? `?${query}` : ""}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
            {isGlobalScope
              ? "Portfolio-wide execution health"
              : scopedProjectName || "Project-scoped metrics"}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`${dashboardInputClassName()} w-44`}
            placeholder="Filter..."
          />
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [isGlobalScope, scopedProjectName, searchTerm, setTopbar]);

  return (
    <>
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminDashboardScreen
          isGlobalScope={isGlobalScope}
          runningRunsCount={runningRunsCount}
          dashboardSummary={dashboardSummary}
          dashboardData={safeDashboard}
          testRuns={testRuns}
          versionHealth={versionHealth}
          projectOverview={dashboardProjectOverview}
          projects={safeProjects}
          plans={safePlans}
          selectedProjectId={selectedProjectId}
          matchesSearch={matchesSearch}
          userName={userName}
          getId={getId}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
