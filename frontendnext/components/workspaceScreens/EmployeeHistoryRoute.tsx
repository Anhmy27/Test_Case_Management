"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmployeeHistoryScreen from "@/components/workspaceScreens/EmployeeHistoryScreen";
import {
  EMPLOYEE_NAV_ITEMS,
  buildEmployeeTopbar,
  useEmployeeProjectScope,
} from "@/components/workspaceScreens/employeeNav";
import { apiRequest, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

function getStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("tcm_token") || "";
}

export default function EmployeeHistoryRoute() {
  const router = useRouter();
  const [token] = useState<string>(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const projectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    const loadRuns = async () => {
      setLoading(true);
      setMessage("");

      try {
        const meResponse = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        const me = meResponse.user;

        if (!me) {
          if (!cancelled) {
            window.localStorage.removeItem("tcm_token");
            router.replace("/");
          }
          return;
        }

        if (me.role === "admin") {
          if (!cancelled) {
            router.replace("/workspace/admin/dashboard");
          }
          return;
        }

        const [projectsResponse, runsResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ testRuns: RecordAny[] }>("/api/test-runs", token),
        ]);
        if (cancelled) {
          return;
        }

        setCurrentUser(me);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load run history");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  const myScopedRuns = useMemo(
    () => projectScope.filterMyRuns(runs, getId(currentUser)),
    [currentUser, projectScope, runs],
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  };

  const loadMyItems = async (runId: string) => {
    if (!runId) {
      return;
    }

    router.push(`/workspace/employee/execution?runId=${encodeURIComponent(runId)}`);
  };

  const handleNavigate = (tab: string) => {
    router.push(`/workspace/employee/${tab}`);
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tcm_token");
      window.localStorage.removeItem("tcm_selected_project_id");
    }

    router.replace("/");
  };

  const topbar = buildEmployeeTopbar({
    tabLabel: "History",
    scopeLabel: projectScope.scopeLabel,
    selectedProjectId: projectScope.selectedProjectId,
    projects: projectScope.safeProjects,
    onProjectChange: projectScope.setSelectedProjectId,
    searchTerm,
    onSearchChange: setSearchTerm,
    searchPlaceholder: "Search by run, plan, executor...",
    stats: [{ label: "runs", value: myScopedRuns.length }],
    onLogout: handleLogout,
  });

  if (loading && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading history...
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      brand={{ title: "Test Case Management", subtitle: "Employee workspace" }}
      user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }}
      navItems={EMPLOYEE_NAV_ITEMS}
      activeKey="history"
      onNavChange={handleNavigate}
      topbar={topbar}
    >
      {message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}
      <EmployeeHistoryScreen
        myScopedRuns={myScopedRuns}
        matchesSearch={matchesSearch}
        loadMyItems={loadMyItems}
        userName={userName}
      />
    </AppShell>
  );
}
