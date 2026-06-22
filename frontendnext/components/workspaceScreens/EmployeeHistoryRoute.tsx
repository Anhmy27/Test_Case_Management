"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmployeeHistoryScreen from "@/components/workspaceScreens/EmployeeHistoryScreen";
import { buildEmployeeTopbar, useEmployeeProjectScope } from "@/components/workspaceScreens/employeeNav";
import { useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function EmployeeHistoryRoute() {
  const router = useRouter();
  const { currentUser, setTopbar, showNotice } = useEmployeeWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const projectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const loadRuns = async () => {
      setLoading(true);

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
          showNotice(error instanceof Error ? error.message : "Unable to load run history", "error");
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

  const myScopedRuns = useMemo(() => {
    const currentUserId = String(getId(currentUser) || "").trim();
    if (!currentUserId) {
      return [];
    }

    return projectScope.filterRuns(runs).filter((run: RecordAny) => {
      const startedByMatch = String(getId(run.startedBy) || "") === currentUserId;
      const ownerSnapshotMatch = String(getId((run as { ownerSnapshot?: unknown }).ownerSnapshot) || "") === currentUserId;
      const assigneeSnapshotMatch = Array.isArray((run as { assigneeSnapshot?: unknown[] }).assigneeSnapshot)
        && (run as { assigneeSnapshot: unknown[] }).assigneeSnapshot.some(
          (assignee) => String(getId(assignee) || "") === currentUserId,
        );

      // History should only include runs started by this employee
      // AND runs belonging to plans assigned to them.
      return startedByMatch && (ownerSnapshotMatch || assigneeSnapshotMatch);
    });
  }, [currentUser, projectScope, runs]);
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
        tabLabel: "History",
        scopeLabel: projectScope.scopeLabel,
        selectedProjectId: projectScope.selectedProjectId,
        projects: projectScope.safeProjects,
        onProjectChange: projectScope.setSelectedProjectId,
        searchTerm,
        onSearchChange: setSearchTerm,
        searchPlaceholder: "Search by run, plan, executor...",
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
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <EmployeeHistoryScreen
          myScopedRuns={myScopedRuns}
          matchesSearch={matchesSearch}
          loadMyItems={loadMyItems}
          userName={userName}
        />
      )}
    </>
  );
}
