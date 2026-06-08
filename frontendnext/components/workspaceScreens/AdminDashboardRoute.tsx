"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardScreen from "@/components/workspaceScreens/AdminDashboardScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;
const PROJECT_SCOPE_STORAGE_KEY = "tcm_selected_project_id";
const PROJECT_SCOPE_TABS = new Set([
  "groups",
  "test-cases",
  "test-cases-history",
  "versions",
  "test-plans",
  "test-runs-execution",
]);

export type DashboardNavigateOptions = {
  projectId?: string;
  query?: Record<string, string | undefined>;
};

export default function AdminDashboardRoute() {
  const router = useRouter();
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);
  const [testRuns, setTestRuns] = useState<RecordAny[]>([]);
  const [versionHealth, setVersionHealth] = useState<RecordAny[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setMessage("");

      try {
        const dashboardQuery = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
        const testRunsQuery = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
        const versionDashboardQuery = selectedProjectId
          ? `/api/dashboard/versions?projectId=${encodeURIComponent(selectedProjectId)}`
          : null;
        const [projectsResponse, plansResponse, dashboardResponse, testRunsResponse, versionDashboardResponse] =
          await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
          apiRequest<RecordAny>(`/api/dashboard${dashboardQuery}`, token),
          apiRequest<{ testRuns: RecordAny[] }>(`/api/test-runs${testRunsQuery}`, token),
          versionDashboardQuery
            ? apiRequest<{ versions: RecordAny[] }>(versionDashboardQuery, token)
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
          setMessage(error instanceof Error ? error.message : "Unable to load dashboard");
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
  }, [currentUser, selectedProjectId, token]);

  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const safePlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const safeDashboard = dashboard || {};
  const dashboardSummary = safeDashboard.summary || {};
  const dashboardProjectOverview = Array.isArray(safeDashboard.projectOverview) ? safeDashboard.projectOverview : [];
  const isGlobalScope = !selectedProjectId;
  const selectedProject = safeProjects.find((project) => getId(project) === selectedProjectId) || null;
  const scopedProjectName = selectedProject?.name || "";
  const runningRunsCount = Number(dashboardSummary.runningRuns || 0);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  };

  const handleNavigate = (tab: string, options?: string | DashboardNavigateOptions) => {
    const normalized: DashboardNavigateOptions =
      typeof options === "string" ? { projectId: options } : options ?? {};
    const explicitProjectId = normalized.projectId?.trim() || "";
    const nextProjectId = explicitProjectId || selectedProjectId;

    if (PROJECT_SCOPE_TABS.has(tab)) {
      if (!nextProjectId) {
        setMessage("Please select a project before opening this section.");
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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            placeholder="Search dashboard..."
          />
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
          >
            <option value="">All projects</option>
            {safeProjects.map((project) => {
              const projectId = getId(project);
              return (
                <option key={projectId || project.code || project.name} value={projectId}>
                  {project.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [safeProjects, searchTerm, selectedProjectId, setSelectedProjectId, setTopbar]);

  return (
    <>
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminDashboardScreen
          isGlobalScope={isGlobalScope}
          scopedProjectName={scopedProjectName}
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
