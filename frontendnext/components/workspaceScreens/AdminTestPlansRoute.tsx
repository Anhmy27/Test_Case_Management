"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminTestPlansScreen from "@/components/workspaceScreens/AdminTestPlansScreen";
import AdminTestPlanInsightsModal from "@/components/workspaceScreens/AdminTestPlanInsightsModal";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, buildDefaultRunName, clearApiRequestCache, createTextMatcher, getId, matchesSelectedEntity, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export type PlanListFilters = {
  versionId: string;
  mode: "all" | "manual" | "automation";
  status: "all" | "has_runs" | "no_runs" | "has_failing";
};

function groupCasesByGroup(groups: RecordAny[], cases: RecordAny[]) {
  return groups.map((group) => ({
    group,
    cases: cases.filter((testCase) => matchesSelectedEntity(testCase.group, getId(group))),
  }));
}

async function fetchWorkspaceData(projectId: string) {
  const projectQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const [
    projectsResponse,
    versionsResponse,
    groupsResponse,
    casesResponse,
    plansResponse,
    runsResponse,
    usersResponse,
  ] = await Promise.all([
    apiRequest<{ projects: RecordAny[] }>("/api/projects"),
    apiRequest<{ versions: RecordAny[] }>("/api/versions"),
    apiRequest<{ groups: RecordAny[] }>("/api/test-case-groups"),
    apiRequest<{ testCases: RecordAny[] }>("/api/test-cases"),
    apiRequest<{ testPlans: RecordAny[] }>(`/api/test-plans${projectQuery}`),
    apiRequest<{ testRuns: RecordAny[] }>(`/api/test-runs${projectQuery}`),
    apiRequest<{ users: RecordAny[] }>("/api/users"),
  ]);

  return {
    projects: Array.isArray(projectsResponse.projects) ? projectsResponse.projects : [],
    versions: Array.isArray(versionsResponse.versions) ? versionsResponse.versions : [],
    groups: Array.isArray(groupsResponse.groups) ? groupsResponse.groups : [],
    testCases: Array.isArray(casesResponse.testCases) ? casesResponse.testCases : [],
    plans: Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : [],
    runs: Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : [],
    users: Array.isArray(usersResponse.users) ? usersResponse.users : [],
  };
}

function applyWorkspaceData(
  data: Awaited<ReturnType<typeof fetchWorkspaceData>>,
  setters: {
    setProjects: (value: RecordAny[]) => void;
    setVersions: (value: RecordAny[]) => void;
    setGroups: (value: RecordAny[]) => void;
    setTestCases: (value: RecordAny[]) => void;
    setPlans: (value: RecordAny[]) => void;
    setRuns: (value: RecordAny[]) => void;
    setUsers: (value: RecordAny[]) => void;
  },
) {
  setters.setProjects(data.projects);
  setters.setVersions(data.versions);
  setters.setGroups(data.groups);
  setters.setTestCases(data.testCases);
  setters.setPlans(data.plans);
  setters.setRuns(data.runs);
  setters.setUsers(data.users);
}

export default function AdminTestPlansRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openInsightsPlanIdFromUrl = searchParams.get("openInsightsPlanId") || "";
  const { currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [users, setUsers] = useState<RecordAny[]>([]);
  const [planForm, setPlanForm] = useState<any>({ name: "", description: "", projectId: "", versionId: "", executionMode: "manual", selectedGroupIds: [], caseIds: [] });
  const [assignDraft, setAssignDraft] = useState({ ownerId: "", assigneeIds: [] as string[] });
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVersionId, setFilterVersionId] = useState("");
  const [filterMode, setFilterMode] = useState<PlanListFilters["mode"]>("all");
  const [filterStatus, setFilterStatus] = useState<PlanListFilters["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [insightsPlan, setInsightsPlan] = useState<{ planId: string; planName: string; projectId: string } | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const autoOpenInsightsTriggered = useRef(false);

  // Auto-open Insights when returning from Execution screen via "Back to Insights" button
  useEffect(() => {
    if (autoOpenInsightsTriggered.current || !openInsightsPlanIdFromUrl || loading || plans.length === 0) return;
    const plan = plans.find((p) => getId(p) === openInsightsPlanIdFromUrl);
    if (plan) {
      autoOpenInsightsTriggered.current = true;
      setInsightsPlan({
        planId: getId(plan),
        planName: String(plan.name || ""),
        projectId: getId(plan.project) || selectedProjectId || "",
      });
    }
  }, [openInsightsPlanIdFromUrl, loading, plans, selectedProjectId]);

  const handleProjectScopeChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setFilterVersionId("");
    if (projectId) {
      setPlanForm((prev: RecordAny) => ({ ...prev, projectId }));
    }
  }, [setSelectedProjectId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const data = await fetchWorkspaceData(selectedProjectId);
        if (cancelled) return;
        applyWorkspaceData(data, {
          setProjects,
          setVersions,
          setGroups,
          setTestCases,
          setPlans,
          setRuns,
          setUsers,
        });
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test plans"); }
      finally { if (!cancelled) setLoading(false); }
    };

    void load();
    return () => { cancelled = true; };
  }, [currentUser, selectedProjectId]);

  const refreshAll = async () => {
    const data = await fetchWorkspaceData(selectedProjectId);
    applyWorkspaceData(data, {
      setProjects,
      setVersions,
      setGroups,
      setTestCases,
      setPlans,
      setRuns,
      setUsers,
    });
  };

  const handleReload = async () => {
    setReloading(true);
    setLoading(true);
    setMessage("");
    clearApiRequestCache();
    try {
      await refreshAll();
      setReloadToken((prev) => prev + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reload test plans");
    } finally {
      setReloading(false);
      setLoading(false);
    }
  };

  const scopedProjects = selectedProjectId
    ? projects.filter((project) => matchesSelectedEntity(project, selectedProjectId))
    : projects;
  const isProjectScoped = Boolean(selectedProjectId);
  const scopedProjectName = scopedProjects[0]?.name || "";
  const scopedVersions = selectedProjectId
    ? versions.filter((version) => matchesSelectedEntity(version.project, selectedProjectId))
    : versions;
  const modalProjectId = String(planForm.projectId || selectedProjectId || "");
  const planProjectGroups = modalProjectId
    ? groups.filter((group) => matchesSelectedEntity(group.project, modalProjectId))
    : groups;
  const planProjectCases = modalProjectId
    ? testCases.filter((testCase) => matchesSelectedEntity(testCase.project, modalProjectId))
    : testCases;
  const selectedPlanGroupIds = new Set<string>(Array.isArray(planForm.selectedGroupIds) ? planForm.selectedGroupIds : []);
  const selectedPlanCaseIds = new Set<string>(Array.isArray(planForm.caseIds) ? planForm.caseIds : []);
  const selectedPlanGroups = groupCasesByGroup(
    planProjectGroups.filter((group) => selectedPlanGroupIds.has(getId(group))),
    planProjectCases,
  );

  const togglePlanGroup = (groupId: string) => {
    setPlanForm((prev: any) => {
      const nextGroupIds = new Set<string>(prev.selectedGroupIds || []);
      if (nextGroupIds.has(groupId)) {
        nextGroupIds.delete(groupId);
      } else {
        nextGroupIds.add(groupId);
      }

      const nextCaseIds = planProjectCases
        .filter((testCase) => {
          const testCaseGroupId = getId(testCase.group);
          return Array.from(nextGroupIds).some((selectedGroupId) =>
            matchesSelectedEntity(testCase.group, selectedGroupId)
            || selectedGroupId === testCaseGroupId,
          );
        })
        .map((testCase) => getId(testCase));

      return {
        ...prev,
        selectedGroupIds: Array.from(nextGroupIds),
        caseIds: Array.from(new Set(nextCaseIds)),
      };
    });
  };

  const togglePlanCase = (groupId: string, caseId: string) => {
    setPlanForm((prev: any) => {
      const caseIds = new Set<string>(prev.caseIds || []);
      if (caseIds.has(caseId)) {
        caseIds.delete(caseId);
      } else {
        caseIds.add(caseId);
      }

      const selectedGroupIds = new Set<string>(prev.selectedGroupIds || []);
      selectedGroupIds.add(groupId);

      return {
        ...prev,
        selectedGroupIds: Array.from(selectedGroupIds),
        caseIds: Array.from(caseIds),
      };
    });
  };

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    const wasCreate = !editingPlanId;
    try {
      const payload = { ...planForm, projectId: planForm.projectId || selectedProjectId };
      if (!Array.isArray(payload.caseIds) || payload.caseIds.length === 0) {
        setMessage("Please select at least one test case before saving the plan.");
        return null;
      }
      let savedPlan: RecordAny | null = null;
      if (editingPlanId) {
        const response = await apiRequest<{ testPlan: RecordAny }>(
          `/api/test-plans/${editingPlanId}`,
          undefined,
          { method: "PUT", body: JSON.stringify(payload) },
        );
        savedPlan = response.testPlan || null;
        setMessage("Test plan updated");
      } else {
        const response = await apiRequest<{ testPlan: RecordAny }>(
          `/api/test-plans`,
          undefined,
          { method: "POST", body: JSON.stringify(payload) },
        );
        savedPlan = response.testPlan || null;
        setMessage("Test plan created");
      }
      setEditingPlanId("");
      setPlanForm({ name: "", description: "", projectId: selectedProjectId || "", versionId: "", executionMode: "manual", selectedGroupIds: [], caseIds: [] });
      await refreshAll();
      return savedPlan ? { plan: savedPlan, created: wasCreate } : null;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save test plan");
      return null;
    }
  };

  const selectPlanForAssignment = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((item) => getId(item) === planId) || null;
    if (plan) {
      setAssignDraft({ ownerId: getId(plan.owner) || getId(currentUser), assigneeIds: Array.isArray(plan.assignees) ? plan.assignees.map((assignee) => getId(assignee)) : [] });
    }
  };

  const saveAssignments = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlanId) return;
    if (!Array.isArray(assignDraft.assigneeIds) || assignDraft.assigneeIds.length === 0) {
      setMessage("Please assign at least one assignee before saving.");
      return;
    }
    await apiRequest(`/api/test-plans/${selectedPlanId}/assign`, undefined, { method: "PUT", body: JSON.stringify({ assigneeIds: assignDraft.assigneeIds, ownerId: assignDraft.ownerId || getId(currentUser) }) });
    await refreshAll();
  };

  const updatePlanExecutionMode = async (planId: string, mode: string) => { await apiRequest(`/api/test-plans/${planId}`, undefined, { method: "PUT", body: JSON.stringify({ executionMode: mode }) }); await refreshAll(); };
  const deletePlan = async (planId: string) => { await apiRequest(`/api/test-plans/${planId}`, undefined, { method: "DELETE" }); await refreshAll(); };
  const duplicatePlan = async (plan: RecordAny) => {
    const caseIds = Array.isArray(plan.items)
      ? plan.items
          .map((item: RecordAny) => getId(item.testCase))
          .filter(Boolean)
      : [];
    await apiRequest(`/api/test-plans`, undefined, {
      method: "POST",
      body: JSON.stringify({
        name: `${plan.name || "Test plan"} copy`,
        description: plan.description || "",
        projectId: getId(plan.project),
        versionId: getId(plan.version),
        executionMode: plan.executionMode || "manual",
        caseIds,
      }),
    });
    await refreshAll();
  };
  const openExecutionForPlan = (plan: RecordAny) => {
    const planId = getId(plan);
    const runName = buildDefaultRunName(plan.name || "Test plan", plan.version?.name);
    router.push(`/workspace/admin/test-runs-execution?testPlanId=${encodeURIComponent(planId)}&runName=${encodeURIComponent(runName)}`);
  };
  const openPlanInsights = (plan: RecordAny) => {
    setInsightsPlan({
      planId: getId(plan),
      planName: String(plan.name || ""),
      projectId: getId(plan.project) || selectedProjectId || "",
    });
  };
  const openRunFromInsights = (runId: string) => {
    const planId = insightsPlan?.planId || "";
    const planName = insightsPlan?.planName || "";
    setInsightsPlan(null);
    const params = new URLSearchParams({ runId });
    if (planId) params.set("fromInsightsPlanId", planId);
    if (planName) params.set("fromInsightsPlanName", planName);
    router.push(`/workspace/admin/test-runs-execution?${params.toString()}`);
  };
  const startNewRunFromInsights = () => {
    if (!insightsPlan) return;
    const plan = plans.find((item) => getId(item) === insightsPlan.planId);
    setInsightsPlan(null);
    if (plan) {
      openExecutionForPlan(plan);
      return;
    }
    const runName = buildDefaultRunName(insightsPlan.planName, "");
    router.push(
      `/workspace/admin/test-runs-execution?testPlanId=${encodeURIComponent(insightsPlan.planId)}&runName=${encodeURIComponent(runName)}`,
    );
  };
  const openRunForPlan = (runId: string, plan: RecordAny) => {
    const planId = getId(plan);
    const planName = String(plan.name || "");
    const params = new URLSearchParams({ runId });
    if (planId) params.set("fromInsightsPlanId", planId);
    if (planName) params.set("fromInsightsPlanName", planName);
    router.push(`/workspace/admin/test-runs-execution?${params.toString()}`);
  };
  const openAllRunsForPlan = (plan: RecordAny) => {
    const planId = getId(plan);
    router.push(`/workspace/admin/test-runs-execution?testPlanId=${encodeURIComponent(planId)}`);
  };
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const topbarVersionOptions = useMemo(() => {
    if (!selectedProjectId) {
      return versions;
    }
    return versions.filter((version) => matchesSelectedEntity(version.project, selectedProjectId));
  }, [selectedProjectId, versions]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Test Plans</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-44 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter plans..."
          />
          <select
            value={selectedProjectId}
            onChange={(event) => handleProjectScopeChange(event.target.value)}
            className={TOPBAR_INPUT_CLS}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={getId(project)} value={getId(project)}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={filterVersionId}
            onChange={(event) => setFilterVersionId(event.target.value)}
            className={`max-w-[140px] ${TOPBAR_INPUT_CLS}`}
            title="Filter by version"
          >
            <option value="">All versions</option>
            {topbarVersionOptions.map((version) => (
              <option key={getId(version)} value={getId(version)}>
                {version.name}
              </option>
            ))}
          </select>
          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value as PlanListFilters["mode"])}
            className={TOPBAR_INPUT_CLS}
            title="Filter by execution mode"
          >
            <option value="all">All modes</option>
            <option value="manual">Manual</option>
            <option value="automation">Automation</option>
          </select>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value as PlanListFilters["status"])}
            className={TOPBAR_INPUT_CLS}
            title="Filter by run status"
          >
            <option value="all">All status</option>
            <option value="has_runs">Has runs</option>
            <option value="no_runs">No runs</option>
            <option value="has_failing">Has failing</option>
          </select>
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [
    filterMode,
    filterStatus,
    filterVersionId,
    handleProjectScopeChange,
    projects,
    searchTerm,
    selectedProjectId,
    setTopbar,
    topbarVersionOptions,
  ]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminTestPlansScreen
          planForm={planForm}
          setPlanForm={setPlanForm}
          createPlan={createPlan}
          listFilters={{ versionId: filterVersionId, mode: filterMode, status: filterStatus }}
          scopedProjects={scopedProjects}
          scopedVersions={scopedVersions}
          planProjectGroups={planProjectGroups}
          planProjectCases={planProjectCases}
          allGroups={groups}
          allTestCases={testCases}
          selectedPlanGroupIds={selectedPlanGroupIds}
          selectedPlanCaseIds={selectedPlanCaseIds}
          selectedPlanGroups={selectedPlanGroups}
          togglePlanGroup={togglePlanGroup}
          togglePlanCase={togglePlanCase}
          users={users}
          currentUser={currentUser}
          selectedPlanId={selectedPlanId}
          selectPlanForAssignment={selectPlanForAssignment}
          assignDraft={assignDraft}
          setAssignDraft={setAssignDraft}
          saveAssignments={saveAssignments}
          scopedPlans={plans}
          editingPlanId={editingPlanId}
          setEditingPlanId={setEditingPlanId}
          updatePlanExecutionMode={updatePlanExecutionMode}
          deletePlan={deletePlan}
          duplicatePlan={duplicatePlan}
          runs={runs}
          openExecutionForPlan={openExecutionForPlan}
          openRunForPlan={openRunForPlan}
          openAllRunsForPlan={openAllRunsForPlan}
          openPlanInsights={openPlanInsights}
          onReload={handleReload}
          reloading={reloading}
          reloadToken={reloadToken}
          userName={userName}
          getId={getId}
          matchesSearch={matchesSearch}
          isProjectScoped={isProjectScoped}
          scopedProjectName={scopedProjectName}
        />
      )}
      {insightsPlan ? (
        <AdminTestPlanInsightsModal
          planId={insightsPlan.planId}
          planName={insightsPlan.planName}
          projectId={insightsPlan.projectId}
          onClose={() => setInsightsPlan(null)}
          onOpenExecution={openRunFromInsights}
          onStartNewRun={startNewRunFromInsights}
        />
      ) : null}
    </>
  );
}
