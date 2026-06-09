"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmployeeRunningTestsScreen from "@/components/workspaceScreens/EmployeeRunningTestsScreen";
import { buildEmployeeTopbar, useEmployeeProjectScope } from "@/components/workspaceScreens/employeeNav";
import { useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function EmployeeRunningTestsRoute() {
  const router = useRouter();
  const { currentUser, setTopbar } = useEmployeeWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const projectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const loadRuns = async () => {
      setLoading(true);
      setMessage("");

      try {
        const [projectsResponse, runsResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
          apiRequest<{ testRuns: RecordAny[] }>("/api/test-runs"),
        ]);
        if (cancelled) {
          return;
        }

        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load running tests");
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
  }, [currentUser]);

  const myScopedRuns = useMemo(
    () => projectScope.filterMyRuns(runs, getId(currentUser)),
    [currentUser, projectScope, runs],
  );
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const loadMyItems = async (runId: string) => {
    if (!runId) {
      return;
    }

    router.push(`/workspace/employee/execution?runId=${encodeURIComponent(runId)}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      buildEmployeeTopbar({
        tabLabel: "Running Tests",
        scopeLabel: projectScope.scopeLabel,
        selectedProjectId: projectScope.selectedProjectId,
        projects: projectScope.safeProjects,
        onProjectChange: projectScope.setSelectedProjectId,
        searchTerm,
        onSearchChange: setSearchTerm,
        searchPlaceholder: "Search by run, plan, status...",
        stats: [{ label: "runs", value: myScopedRuns.length }],
      }),
    );

    return () => setTopbar(null);
  }, [
    myScopedRuns.length,
    projectScope.safeProjects,
    projectScope.scopeLabel,
    projectScope.selectedProjectId,
    projectScope.setSelectedProjectId,
    searchTerm,
    setTopbar,
  ]);

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
        <EmployeeRunningTestsScreen
          myScopedRuns={myScopedRuns}
          matchesSearch={matchesSearch}
          loadMyItems={loadMyItems}
          userName={userName}
        />
      )}
    </>
  );
}
