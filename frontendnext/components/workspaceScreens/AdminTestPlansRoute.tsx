"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminTestPlansScreen from "@/components/workspaceScreens/AdminTestPlansScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, buildDefaultRunName, createTextMatcher, getId, matchesSelectedEntity, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

function groupCasesByGroup(groups: RecordAny[], cases: RecordAny[]) {
  return groups.map((group) => ({
    group,
    cases: cases.filter((testCase) => getId(testCase.group) === getId(group)),
  }));
}

export default function AdminTestPlansRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const versionIdFromUrl = String(searchParams.get("versionId") || "").trim();
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const handleProjectScopeChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      setPlanForm((prev: RecordAny) => ({ ...prev, projectId }));
    }
  };

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const [projectsResponse, versionsResponse, groupsResponse, casesResponse, plansResponse, runsResponse, usersResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
          apiRequest<{ testRuns: RecordAny[] }>(selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs", token),
          apiRequest<{ users: RecordAny[] }>("/api/users", token),
        ]);

        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setVersions(Array.isArray(versionsResponse.versions) ? versionsResponse.versions : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(casesResponse.testCases) ? casesResponse.testCases : []);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
        setUsers(Array.isArray(usersResponse.users) ? usersResponse.users : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test plans"); }
      finally { if (!cancelled) setLoading(false); }
    };

    void load();
    return () => { cancelled = true; };
  }, [currentUser, selectedProjectId, token]);

  const refreshAll = async () => {
    const [projectsResponse, versionsResponse, groupsResponse, casesResponse, plansResponse, runsResponse, usersResponse] = await Promise.all([
      apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
      apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions", token),
      apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
      apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
      apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
      apiRequest<{ testRuns: RecordAny[] }>(selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs", token),
      apiRequest<{ users: RecordAny[] }>("/api/users", token),
    ]);

    setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
    setVersions(Array.isArray(versionsResponse.versions) ? versionsResponse.versions : []);
    setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
    setTestCases(Array.isArray(casesResponse.testCases) ? casesResponse.testCases : []);
    setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
    setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
    setUsers(Array.isArray(usersResponse.users) ? usersResponse.users : []);
  };

  const scopedProjects = selectedProjectId
    ? projects.filter((project) => matchesSelectedEntity(project, selectedProjectId))
    : projects;
  const isProjectScoped = Boolean(selectedProjectId);
  const scopedProjectName = scopedProjects[0]?.name || "";
  const scopedVersions = selectedProjectId
    ? versions.filter((version) => matchesSelectedEntity(version.project, selectedProjectId))
    : versions;
  const planProjectGroups = selectedProjectId
    ? groups.filter((group) => matchesSelectedEntity(group.project, selectedProjectId))
    : groups;
  const planProjectCases = selectedProjectId
    ? testCases.filter((testCase) => matchesSelectedEntity(testCase.project, selectedProjectId))
    : testCases;
  const selectedPlanGroupIds = new Set<string>(Array.isArray(planForm.selectedGroupIds) ? planForm.selectedGroupIds : []);
  const selectedPlanCaseIds = new Set<string>(Array.isArray(planForm.caseIds) ? planForm.caseIds : []);
  const selectedPlanGroups = groupCasesByGroup(planProjectGroups.filter((group) => selectedPlanGroupIds.has(getId(group))), planProjectCases);
  const selectedPlanCasesByGroup = groupCasesByGroup(
    planProjectGroups.filter((group) => selectedPlanGroupIds.has(getId(group))),
    planProjectCases,
  );

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    setPlanForm((prev: RecordAny) => ({
      ...prev,
      projectId: selectedProjectId,
    }));
  }, [selectedProjectId]);

  const togglePlanGroup = (groupId: string) => {
    setPlanForm((prev: any) => {
      const nextGroupIds = new Set<string>(prev.selectedGroupIds || []);
      if (nextGroupIds.has(groupId)) nextGroupIds.delete(groupId); else nextGroupIds.add(groupId);
      const nextCaseIds = planProjectCases
        .filter((testCase) => nextGroupIds.has(getId(testCase.group)))
        .map((testCase) => getId(testCase));
      return { ...prev, selectedGroupIds: Array.from(nextGroupIds), caseIds: Array.from(new Set(nextCaseIds)) };
    });
  };

  const togglePlanCase = (groupId: string, caseId: string) => {
    setPlanForm((prev: any) => {
      const caseIds = new Set<string>(prev.caseIds || []);
      if (caseIds.has(caseId)) caseIds.delete(caseId); else caseIds.add(caseId);
      const selectedGroupIds = new Set<string>(prev.selectedGroupIds || []);
      selectedGroupIds.add(groupId);
      return { ...prev, selectedGroupIds: Array.from(selectedGroupIds), caseIds: Array.from(caseIds) };
    });
  };

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...planForm, projectId: planForm.projectId || selectedProjectId };
      if (editingPlanId) {
        await apiRequest(`/api/test-plans/${editingPlanId}`, token, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Test plan updated");
      } else {
        await apiRequest(`/api/test-plans`, token, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Test plan created");
      }
      setEditingPlanId("");
      setPlanForm({ name: "", description: "", projectId: selectedProjectId || "", versionId: "", executionMode: "manual", selectedGroupIds: [], caseIds: [] });
      await refreshAll();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save test plan");
      return false;
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
    await apiRequest(`/api/test-plans/${selectedPlanId}/assign`, token, { method: "PUT", body: JSON.stringify({ assigneeIds: assignDraft.assigneeIds, ownerId: assignDraft.ownerId || getId(currentUser) }) });
    await refreshAll();
  };

  const updatePlanExecutionMode = async (planId: string, mode: string) => { await apiRequest(`/api/test-plans/${planId}`, token, { method: "PUT", body: JSON.stringify({ executionMode: mode }) }); await refreshAll(); };
  const deletePlan = async (planId: string) => { await apiRequest(`/api/test-plans/${planId}`, token, { method: "DELETE" }); await refreshAll(); };
  const duplicatePlan = async (plan: RecordAny) => {
    const caseIds = Array.isArray(plan.items)
      ? plan.items
          .map((item: RecordAny) => getId(item.testCase))
          .filter(Boolean)
      : [];
    await apiRequest(`/api/test-plans`, token, {
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
  const setActiveTab = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);
  const versionFilter = versions.find((version) => matchesSelectedEntity(version, versionIdFromUrl)) || null;

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Test Plans</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
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
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [handleProjectScopeChange, projects, searchTerm, selectedProjectId, setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {versionFilter ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Showing plans for version <span className="font-semibold">{versionFilter.name}</span>.
          <button
            type="button"
            onClick={() => router.push("/workspace/admin/test-plans")}
            className="ml-3 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:border-sky-300"
          >
            Clear filter
          </button>
        </div>
      ) : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminTestPlansScreen
          planForm={planForm}
          setPlanForm={setPlanForm}
          createPlan={createPlan}
          scopedProjects={scopedProjects}
          scopedVersions={scopedVersions}
          planProjectGroups={planProjectGroups}
          planProjectCases={planProjectCases}
          selectedPlanGroupIds={selectedPlanGroupIds}
          selectedPlanCaseIds={selectedPlanCaseIds}
          selectedPlanGroups={selectedPlanGroups}
          selectedPlanCasesByGroup={selectedPlanCasesByGroup}
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
          versionFilterId={versionIdFromUrl}
          editingPlanId={editingPlanId}
          setEditingPlanId={setEditingPlanId}
          updatePlanExecutionMode={updatePlanExecutionMode}
          deletePlan={deletePlan}
          duplicatePlan={duplicatePlan}
          runs={runs}
          openExecutionForPlan={openExecutionForPlan}
          setActiveTab={setActiveTab as any}
          userName={userName}
          getId={getId}
          matchesSearch={matchesSearch}
          isProjectScoped={isProjectScoped}
          scopedProjectName={scopedProjectName}
        />
      )}
    </>
  );
}
