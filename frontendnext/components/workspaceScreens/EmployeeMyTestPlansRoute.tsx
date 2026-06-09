"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EmployeeMyTestPlansScreen from "@/components/workspaceScreens/EmployeeMyTestPlansScreen";
import { buildEmployeeTopbar, useEmployeeProjectScope } from "@/components/workspaceScreens/employeeNav";
import { useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function EmployeeMyTestPlansRoute() {
  const router = useRouter();
  const { currentUser, setTopbar } = useEmployeeWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const projectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      setMessage("");

      try {
        const [projectsResponse, plansResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
          apiRequest<{ testPlans: RecordAny[] }>("/api/test-plans"),
        ]);
        if (cancelled) {
          return;
        }

        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load assigned plans");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const scopedPlans = useMemo(
    () => projectScope.filterPlans(plans),
    [plans, projectScope],
  );
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const openExecutionForPlan = (plan: RecordAny) => {
    const planId = getId(plan);
    if (!planId) {
      return;
    }

    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const runName = `${plan.name || "Test plan"} - ${stamp}`;
    const params = new URLSearchParams({
      testPlanId: planId,
      runName,
    });

    router.push(`/workspace/employee/execution?${params.toString()}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      buildEmployeeTopbar({
        tabLabel: "My Test Plans",
        scopeLabel: projectScope.scopeLabel,
        selectedProjectId: projectScope.selectedProjectId,
        projects: projectScope.safeProjects,
        onProjectChange: projectScope.setSelectedProjectId,
        searchTerm,
        onSearchChange: setSearchTerm,
        searchPlaceholder: "Search by plan, project, version...",
        stats: [
          { label: "projects", value: projectScope.safeProjects.length },
          { label: "plans", value: scopedPlans.length },
        ],
      }),
    );

    return () => setTopbar(null);
  }, [
    projectScope.safeProjects,
    projectScope.scopeLabel,
    projectScope.selectedProjectId,
    projectScope.setSelectedProjectId,
    scopedPlans.length,
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
        <EmployeeMyTestPlansScreen
          scopedPlans={scopedPlans}
          matchesSearch={matchesSearch}
          openExecutionForPlan={openExecutionForPlan}
        />
      )}
    </>
  );
}
