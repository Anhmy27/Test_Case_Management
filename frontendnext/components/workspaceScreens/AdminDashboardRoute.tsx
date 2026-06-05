"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardScreen from "@/components/workspaceScreens/AdminDashboardScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminDashboardRoute() {
  const router = useRouter();
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar, handleLogout } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [users, setUsers] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);
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
        const [projectsResponse, plansResponse, dashboardResponse, usersResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
          apiRequest<RecordAny>(`/api/dashboard${dashboardQuery}`, token),
          apiRequest<{ users: RecordAny[] }>("/api/users", token),
        ]);

        if (cancelled) {
          return;
        }

        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setUsers(Array.isArray(usersResponse.users) ? usersResponse.users : []);
        setDashboard(dashboardResponse || null);
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
  const totalProjects = safeProjects.length;
  const totalPlans = safePlans.length;
  const totalCases = Number(dashboardSummary.totalCases || 0);
  const runningRunsCount = Number(dashboardSummary.runningRuns || 0);
  const totalUsers = users.length;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  };

  const handleNavigate = (tab: string, projectId?: string) => {
    if (typeof projectId === "string") {
      setSelectedProjectId(projectId);
    }

    router.push(`/workspace/admin/${tab}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Dashboard</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Search
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="Filter dashboard cards"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            Project scope
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
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
          </label>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [handleLogout, safeProjects, searchTerm, selectedProjectId, setSelectedProjectId, setTopbar]);

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
          totalProjects={totalProjects}
          totalPlans={totalPlans}
          totalCases={totalCases}
          runningRunsCount={runningRunsCount}
          totalUsers={totalUsers}
          dashboardSummary={dashboardSummary}
          dashboardData={safeDashboard}
          projectOverview={dashboardProjectOverview}
          projects={safeProjects}
          matchesSearch={matchesSearch}
          userName={userName}
          getId={getId}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
