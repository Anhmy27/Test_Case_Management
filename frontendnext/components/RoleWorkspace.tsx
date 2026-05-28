"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getId, userName } from "@/lib/api";
import AppShell from "./AppShell";
import AdminDashboardScreen from "@/components/workspaceScreens/AdminDashboardScreen";
import AdminProjectsScreen from "./workspaceScreens/AdminProjectsScreen";
import AdminGroupsScreen from "./workspaceScreens/AdminGroupsScreen";
import AdminTestCasesScreen from "./workspaceScreens/AdminTestCasesScreen";
import AdminTestCasesDetailScreen from "./workspaceScreens/AdminTestCasesDetailScreen";
import AdminVersionsScreen from "./workspaceScreens/AdminVersionsScreen";
import AdminIssueTypesScreen from "./workspaceScreens/AdminIssueTypesScreen";
import AdminTestPlansScreen from "@/components/workspaceScreens/AdminTestPlansScreen";
import AdminTestRunsScreen from "./workspaceScreens/AdminTestRunsScreen";
import AdminUsersScreen from "./workspaceScreens/AdminUsersScreen";
import EmployeeMyTestPlansScreen from "./workspaceScreens/EmployeeMyTestPlansScreen";
import EmployeeRunningTestsScreen from "./workspaceScreens/EmployeeRunningTestsScreen";
import EmployeeHistoryScreen from "./workspaceScreens/EmployeeHistoryScreen";
import ExecutionScreen from "./workspaceScreens/ExecutionScreen";

type RecordAny = Record<string, any>;

type WorkspaceProps = {
  workspace: Record<string, any>;
  overrideContent?: ReactNode;
};

const adminNav = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "groups", label: "Groups" },
  { key: "test-cases", label: "Test Cases" },
  { key: "test-cases-detail", label: "Test Cases Detail" },
  { key: "versions", label: "Versions" },
  { key: "issue-types", label: "Issue Types" },
  { key: "test-plans", label: "Test Plans" },
  { key: "test-runs", label: "Test Runs" },
  { key: "execution", label: "Execution" },
  { key: "users", label: "Users" },
] as const;

const employeeNav = [
  { key: "my-test-plans", label: "My Test Plans" },
  { key: "running-tests", label: "Running Tests" },
  { key: "history", label: "History" },
  { key: "execution", label: "Run Test" },
] as const;

export default function RoleWorkspace({ workspace, overrideContent }: WorkspaceProps) {
  const {
    currentUser,
    isAdmin,
    activeTab,
    setActiveTab,
    logout,
    dashboard,
    projects,
    versions,
    groups,
    testCases,
    plans,
    runs,
    users,
    selectedProjectId,
    setSelectedProjectId,
    projectForm,
    setProjectForm,
    editingProjectId,
    startProjectEdit,
    cancelProjectEdit,
    saveProject,
    deleteProject,
    versionForm,
    setVersionForm,
    editingVersionId,
    startVersionEdit,
    cancelVersionEdit,
    deleteVersion,
    issueTypes,
    issueTypeForm,
    setIssueTypeForm,
    createIssueType,
    editingIssueTypeId,
    startIssueTypeEdit,
    cancelIssueTypeEdit,
    deleteIssueType,
    groupForm,
    setGroupForm,
    editingGroupId,
    startGroupEdit,
    cancelGroupEdit,
    deleteGroup,
    testCaseForm,
    setTestCaseForm,
    automationForm,
    setAutomationForm,
    editingTestCaseId,
    startTestCaseEdit,
    cancelTestCaseEdit,
    saveTestCase,
    deleteTestCase,
    deleteTestCasesBulk,
    duplicateTestCase,
    duplicateTestCasesBulk,
    addTestCaseStep,
    updateTestCaseStep,
    removeTestCaseStep,
    moveTestCaseStep,
    addAutomationStep,
    updateAutomationStep,
    removeAutomationStep,
    moveAutomationStep,
    planForm,
    setPlanForm,
    runForm,
    setRunForm,
    newUserForm,
    setNewUserForm,
    editingUserId,
    startUserEdit,
    cancelUserEdit,
    selectedPlanId,
    selectPlanForAssignment,
    assignDraft,
    setAssignDraft,
    saveAssignments,
    editingPlanId,
    setEditingPlanId,
    editingExecutionMode,
    setEditingExecutionMode,
    updatePlanExecutionMode,
    deletePlan,
    duplicatePlan,
    createVersion,
    createGroup,
    createPlan,
    createUser,
    deleteUser,
    setSelectedRunId,
    myItems,
    loadMyItems,
    loadTestCaseDetails,
    downloadTestCaseTemplate,
    importTestCases,
    selectedRun,
    endRun,
    updateResult,
    startRun,
    openJiraBugDialog,
    resetWorkspaceDrafts,
    message,
  } = workspace;

  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchPreset, setSearchPreset] = useState<
    "all" | "risk" | "running" | "my-items"
  >("all");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string>("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const safeProjects = useMemo(() => (Array.isArray(projects) ? projects : []), [projects]);
  const safeVersions = useMemo(() => (Array.isArray(versions) ? versions : []), [versions]);
  const safeGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);
  const safeTestCases = useMemo(() => (Array.isArray(testCases) ? testCases : []), [testCases]);
  const safePlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const safeRuns = useMemo(() => (Array.isArray(runs) ? runs : []), [runs]);
  const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const safeMyItems = useMemo(() => (Array.isArray(myItems) ? myItems : []), [myItems]);
  const safeIssueTypes = useMemo(() => (Array.isArray(issueTypes) ? issueTypes : []), [issueTypes]);

  useEffect(() => {
    if (!safeMyItems.length) {
      setSelectedItemId("");
      return;
    }

    if (
      !selectedItemId ||
      !safeMyItems.some((item: RecordAny) => getId(item) === selectedItemId)
    ) {
      setSelectedItemId(getId(safeMyItems[0]));
    }
  }, [safeMyItems, selectedItemId]);

  const selectedItem = safeMyItems.find(
    (item: RecordAny) => getId(item) === selectedItemId,
  );
  const currentUserId = getId(currentUser);
  const isAutomationRun = Boolean(
    selectedRun && selectedRun.testPlan && String(selectedRun.testPlan.executionMode) === "automation",
  );
  const selectedRunStartedByCurrentUser =
    String(getId(selectedRun?.startedBy) || getId(selectedRun?.startedBy) || "") ===
    currentUserId;
  const currentUserLabel = userName(currentUser);
  const canEditSelectedRun = Boolean(
    selectedRun &&
      selectedRun.status === "running" &&
      selectedRunStartedByCurrentUser &&
      !isAutomationRun,
  );

  const dashboardData = dashboard || {};
  const dashboardSummary = dashboardData.summary || {};
  const projectOverview = dashboardData.projectOverview || [];
  const selectedProject = safeProjects.find(
    (project: RecordAny) => getId(project) === selectedProjectId,
  );
  const hasValidProjectScope = Boolean(selectedProjectId && selectedProject);
  const effectiveProjectId = hasValidProjectScope ? selectedProjectId : "";
  const scopeLabel = selectedProject ? selectedProject.name : "All projects";
  const isGlobalScope = !effectiveProjectId;
  const scopedProjects = isGlobalScope
    ? safeProjects
    : selectedProject
      ? [selectedProject]
      : [];
  const scopedVersions = isGlobalScope
    ? safeVersions
    : safeVersions.filter(
        (version: RecordAny) => getId(version.project) === effectiveProjectId,
      );
  const scopedGroups = isGlobalScope
    ? safeGroups
    : safeGroups.filter(
        (group: RecordAny) => getId(group.project) === effectiveProjectId,
      );
  const scopedPlans = isGlobalScope
    ? safePlans
    : safePlans.filter(
        (plan: RecordAny) => getId(plan.project) === effectiveProjectId,
      );
  const selectedRunPlan = scopedPlans.find(
    (plan: RecordAny) => getId(plan) === String(runForm.testPlanId),
  );
  const selectedRunPlanIsAutomation =
    String(selectedRunPlan?.executionMode || "manual") === "automation";
  const scopedRuns = isGlobalScope
    ? safeRuns
    : safeRuns.filter(
        (run: RecordAny) => getId(run.testPlan?.project ?? run.project) === effectiveProjectId,
      );
  const myScopedRuns = scopedRuns.filter(
    (run: RecordAny) => String(getId(run.startedBy) || getId(run.startedBy) || "") === currentUserId,
  );
  const adminRuns = isAdmin ? safeRuns : scopedRuns;
  const navItems = (() => {
    if (!isAdmin) return employeeNav;

    const allowedForGlobal = [
      "dashboard",
      "projects",
      "issue-types",
      "execution",
      "users",
    ];

    const allowedForProject = [
      "dashboard",
      "groups",
      "test-cases",
      "test-cases-detail",
      "versions",
      "test-plans",
      "test-runs",
      "execution",
      "users",
    ];

    const allowed = isGlobalScope ? allowedForGlobal : allowedForProject;
    return adminNav.filter((item) => allowed.includes(item.key));
  })();
  const visibleTab = navItems.some((item) => item.key === activeTab)
    ? activeTab
    : navItems[0].key;
  const activeTabLabel =
    navItems.find((item) => item.key === visibleTab)?.label || "Workspace";
  const normalizedSearch = searchTerm.trim().toLowerCase();

  useEffect(() => {
    setSelectedItemId("");
    setNotes({});
    setSearchTerm("");
    setSearchPreset("all");
    setDetailGroupId("");
  }, [visibleTab]);

  useEffect(() => {
    if (!isAdmin || visibleTab !== "test-cases-detail") {
      return;
    }

    if (!selectedProjectId) {
      setDetailRows([]);
      return;
    }

    const loadRows = async () => {
      try {
        setDetailLoading(true);
        const rows = await loadTestCaseDetails({
          projectId: selectedProjectId,
          groupId: detailGroupId,
          search: searchTerm,
        });
        setDetailRows(rows || []);
      } catch {
        setDetailRows([]);
      } finally {
        setDetailLoading(false);
      }
    };

    void loadRows();
  }, [
    isAdmin,
    visibleTab,
    selectedProjectId,
    detailGroupId,
    searchTerm,
    loadTestCaseDetails,
  ]);

  const totalProjects = safeProjects.length;
  const totalPlans = safePlans.length;
  const totalCases = safeTestCases.length;
  const totalUsers = safeUsers.length;
  const runningRuns = safeRuns.filter((run: RecordAny) => run.status === "running");
  const runningRunsCount = runningRuns.length;
  const planProjectGroups = planForm.projectId
    ? safeGroups.filter(
        (group: RecordAny) => getId(group.project) === planForm.projectId,
      )
    : [];
  const planProjectCases = planForm.projectId
    ? safeTestCases.filter(
        (testCase: RecordAny) => getId(testCase.project) === planForm.projectId,
      )
    : [];
  const selectedPlanGroupIds = new Set(planForm.selectedGroupIds || []);
  const selectedPlanCaseIds = new Set(planForm.caseIds || []);
  const selectedPlanGroups = planProjectGroups.filter((group: RecordAny) =>
    selectedPlanGroupIds.has(getId(group)),
  );
  const selectedPlanCasesByGroup = selectedPlanGroups.map((group: RecordAny) => {
    const groupId = getId(group);
    return {
      group,
      cases: planProjectCases.filter(
        (testCase: RecordAny) => getId(testCase.group) === groupId,
      ),
    };
  });

  function togglePlanGroup(groupId: string) {
    setPlanForm((prev: any) => {
      const nextGroupIds = prev.selectedGroupIds.includes(groupId)
        ? prev.selectedGroupIds.filter((id: string) => id !== groupId)
        : [...prev.selectedGroupIds, groupId];
      const nextGroupSet = new Set(nextGroupIds);
      const nextCaseIds = prev.caseIds.filter((caseId: string) => {
        const linkedCase = testCases.find(
          (testCase: RecordAny) => getId(testCase) === caseId,
        );

        return linkedCase && nextGroupSet.has(getId(linkedCase.group));
      });

      return {
        ...prev,
        selectedGroupIds: nextGroupIds,
        caseIds: nextCaseIds,
      };
    });
  }

  function togglePlanCase(groupId: string, caseId: string) {
    setPlanForm((prev: any) => {
      const nextGroupIds = prev.selectedGroupIds.includes(groupId)
        ? prev.selectedGroupIds
        : [...prev.selectedGroupIds, groupId];
      const nextCaseIds = prev.caseIds.includes(caseId)
        ? prev.caseIds.filter((id: string) => id !== caseId)
        : [...prev.caseIds, caseId];

      return {
        ...prev,
        selectedGroupIds: nextGroupIds,
        caseIds: nextCaseIds,
      };
    });
  }

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const allowedTabs = isGlobalScope
      ? ["dashboard", "projects", "issue-types", "execution", "users"]
      : [
          "dashboard",
          "groups",
          "test-cases",
          "test-cases-detail",
          "versions",
          "test-plans",
          "test-runs",
          "execution",
          "users",
        ];

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [isAdmin, isGlobalScope, activeTab, setActiveTab]);

  useEffect(() => {
    selectPlanForAssignment("");
    setRunForm((prev: any) => ({
      ...prev,
      testPlanId: "",
    }));
    setSearchPreset("all");

    if (!selectedProjectId) {
      return;
    }

    setPlanForm((prev: any) => ({
      ...prev,
      projectId: selectedProjectId,
      versionId: "",
      caseIds: [],
    }));
  }, [selectedProjectId, selectPlanForAssignment, setPlanForm, setRunForm]);

  const matchesSearch = (
    ...values: Array<string | number | undefined | null>
  ) => {
    const normalizedValues = values
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

    if (searchPreset === "running" && !normalizedValues.includes("running")) {
      return false;
    }

    if (searchPreset === "risk") {
      const hasRiskSignal =
        normalizedValues.includes("fail") ||
        normalizedValues.includes("blocked") ||
        normalizedValues.includes("delayed") ||
        normalizedValues.includes("overdue") ||
        normalizedValues.includes("pending");

      if (!hasRiskSignal) {
        return false;
      }
    }

    if (
      searchPreset === "my-items" &&
      !normalizedValues.includes(currentUserLabel.toLowerCase())
    ) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return normalizedValues.includes(normalizedSearch);
  };

  const searchPresetButtons = [
    { key: "all", label: "All" },
    { key: "running", label: "Running" },
    { key: "risk", label: "Risk" },
    { key: "my-items", label: "My items" },
  ] as const;

  const topbar = (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-[220px]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Workspace
        </div>
        <div className="text-xl font-semibold text-slate-900">
          {activeTabLabel}
        </div>
        <div className="text-sm text-slate-500">
          Scope: <span className="font-medium text-slate-700">{scopeLabel}</span>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs font-semibold text-slate-500">
            Project scope
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <option value="">All projects</option>
            {safeProjects.map((project: RecordAny) => (
              <option key={getId(project)} value={getId(project)}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[260px]">
          <label className="text-xs font-semibold text-slate-500">Search</label>
          <div className="relative mt-1">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, code, key, status..."
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
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            {projects.length} projects
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            {plans.length} plans
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
            {runs.length} runs
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      brand={{
        title: "Test Case Management",
        subtitle: isAdmin ? "Admin workspace" : "Tester workspace",
      }}
      user={{
        name: currentUser?.name || "User",
        email: currentUser?.email || "",
        role: currentUser?.role || "",
      }}
      navItems={navItems}
      activeKey={visibleTab}
      onNavChange={(key) => {
        resetWorkspaceDrafts();
        setActiveTab(key as any);
      }}
      topbar={topbar}
      sidebarFooter={
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Dang xuat
        </button>
      }
    >
      {message && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Quick filters
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchPresetButtons.map((button) => (
              <button
                key={button.key}
                type="button"
                className={
                  searchPreset === button.key
                    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }
                onClick={() => setSearchPreset(button.key)}
              >
                {button.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {searchPreset === "all" ? "All records" : searchPreset}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
              {normalizedSearch ? `Searching: ${searchTerm}` : "No text filter"}
            </span>
          </div>
        </div>
      </div>

      {overrideContent ? (
        overrideContent
      ) : (
        <>

        {isAdmin && visibleTab === "dashboard" && (
          <AdminDashboardScreen
            isGlobalScope={isGlobalScope}
            totalProjects={totalProjects}
            totalPlans={totalPlans}
            totalCases={totalCases}
            runningRunsCount={runningRunsCount}
            totalUsers={totalUsers}
            dashboardSummary={dashboardSummary}
            dashboardData={dashboardData}
            projectOverview={projectOverview}
            projects={safeProjects}
            matchesSearch={matchesSearch}
            userName={userName}
            getId={getId}
            onNavigate={(tab, projectId) => {
              if (projectId !== undefined) {
                setSelectedProjectId(projectId);
              }
              setActiveTab(tab as any);
            }}
          />
        )}

        {isAdmin && visibleTab === "projects" && (
          <AdminProjectsScreen
            editingProjectId={editingProjectId}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            saveProject={saveProject}
            cancelProjectEdit={cancelProjectEdit}
            projects={safeProjects}
            matchesSearch={matchesSearch}
            startProjectEdit={startProjectEdit}
            deleteProject={deleteProject}
          />
        )}

        {isAdmin && visibleTab === "groups" && (
          <AdminGroupsScreen
            groupForm={groupForm}
            setGroupForm={setGroupForm}
            editingGroupId={editingGroupId}
            startGroupEdit={startGroupEdit}
            cancelGroupEdit={cancelGroupEdit}
            deleteGroup={deleteGroup}
            createGroup={createGroup}
            scopedProjects={scopedProjects}
            groups={safeGroups}
            testCases={safeTestCases}
            startTestCaseEdit={startTestCaseEdit}
            matchesSearch={matchesSearch}
          />
        )}

        {isAdmin && visibleTab === "test-cases" && (
          <AdminTestCasesScreen
            editingTestCaseId={editingTestCaseId}
            testCaseForm={testCaseForm}
            setTestCaseForm={setTestCaseForm}
            automationForm={automationForm}
            setAutomationForm={setAutomationForm}
            addTestCaseStep={addTestCaseStep}
            updateTestCaseStep={updateTestCaseStep}
            removeTestCaseStep={removeTestCaseStep}
            moveTestCaseStep={moveTestCaseStep}
            addAutomationStep={addAutomationStep}
            updateAutomationStep={updateAutomationStep}
            removeAutomationStep={removeAutomationStep}
            moveAutomationStep={moveAutomationStep}
            saveTestCase={saveTestCase}
            cancelTestCaseEdit={cancelTestCaseEdit}
            testCases={safeTestCases}
            matchesSearch={matchesSearch}
            startTestCaseEdit={startTestCaseEdit}
            deleteTestCase={deleteTestCase}
            deleteTestCases={deleteTestCasesBulk}
            duplicateTestCase={duplicateTestCase}
            duplicateTestCases={duplicateTestCasesBulk}
            scopedProjects={scopedProjects}
            scopedGroups={scopedGroups}
            selectedProjectId={selectedProjectId}
            downloadTestCaseTemplate={downloadTestCaseTemplate}
            importTestCases={importTestCases}
            importInputRef={importInputRef}
          />
        )}

        {isAdmin && visibleTab === "test-cases-detail" && (
          <AdminTestCasesDetailScreen
            selectedProjectId={selectedProjectId}
            detailGroupId={detailGroupId}
            setDetailGroupId={setDetailGroupId}
            scopedGroups={scopedGroups}
            detailLoading={detailLoading}
            detailRows={detailRows}
            matchesSearch={matchesSearch}
          />
        )}

        {isAdmin && visibleTab === "versions" && (
          <AdminVersionsScreen
            versionForm={versionForm}
            setVersionForm={setVersionForm}
            editingVersionId={editingVersionId}
            startVersionEdit={startVersionEdit}
            cancelVersionEdit={cancelVersionEdit}
            deleteVersion={deleteVersion}
            createVersion={createVersion}
            scopedProjects={scopedProjects}
            versions={safeVersions}
            projects={safeProjects}
            matchesSearch={matchesSearch}
            getId={getId}
          />
        )}

        {isAdmin && visibleTab === "issue-types" && (
          <AdminIssueTypesScreen
            issueTypeForm={issueTypeForm}
            setIssueTypeForm={setIssueTypeForm}
            createIssueType={createIssueType}
            editingIssueTypeId={editingIssueTypeId}
            startIssueTypeEdit={startIssueTypeEdit}
            cancelIssueTypeEdit={cancelIssueTypeEdit}
            deleteIssueType={deleteIssueType}
            issueTypes={safeIssueTypes}
            matchesSearch={matchesSearch}
          />
        )}

        {isAdmin && visibleTab === "test-plans" && (
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
            users={safeUsers}
            currentUser={currentUser}
            selectedPlanId={selectedPlanId}
            selectPlanForAssignment={selectPlanForAssignment}
            assignDraft={assignDraft}
            setAssignDraft={setAssignDraft}
            saveAssignments={saveAssignments}
            scopedPlans={scopedPlans}
            editingPlanId={editingPlanId}
            editingExecutionMode={editingExecutionMode}
            setEditingPlanId={setEditingPlanId}
            setEditingExecutionMode={setEditingExecutionMode}
            updatePlanExecutionMode={updatePlanExecutionMode}
            deletePlan={deletePlan}
            duplicatePlan={duplicatePlan}
            runs={safeRuns}
            setRunForm={setRunForm}
            setActiveTab={setActiveTab}
            userName={userName}
            getId={getId}
            matchesSearch={matchesSearch}
          />
        )}

        {isAdmin && visibleTab === "test-runs" && (
          <AdminTestRunsScreen
            runForm={runForm}
            setRunForm={setRunForm}
            startRun={startRun}
            scopedPlans={scopedPlans}
            selectedRunPlanIsAutomation={selectedRunPlanIsAutomation}
            adminRuns={adminRuns}
            matchesSearch={matchesSearch}
            userName={userName}
            currentUserId={currentUserId}
            setSelectedRunId={setSelectedRunId}
            loadMyItems={loadMyItems}
            setActiveTab={setActiveTab}
          />
        )}

        {isAdmin && visibleTab === "users" && (
          <AdminUsersScreen
            newUserForm={newUserForm}
            setNewUserForm={setNewUserForm}
            editingUserId={editingUserId}
            startUserEdit={startUserEdit}
            cancelUserEdit={cancelUserEdit}
            createUser={createUser}
            deleteUser={deleteUser}
            users={safeUsers}
            matchesSearch={matchesSearch}
            currentUserId={currentUserId}
          />
        )}

        {!isAdmin && visibleTab === "my-test-plans" && (
          <EmployeeMyTestPlansScreen
            scopedPlans={scopedPlans}
            matchesSearch={matchesSearch}
            setRunForm={setRunForm}
            setActiveTab={setActiveTab}
          />
        )}

        {!isAdmin && visibleTab === "running-tests" && (
          <EmployeeRunningTestsScreen
            myScopedRuns={myScopedRuns}
            matchesSearch={matchesSearch}
            setSelectedRunId={setSelectedRunId}
            loadMyItems={loadMyItems}
            setActiveTab={setActiveTab}
            userName={userName}
          />
        )}

        {!isAdmin && visibleTab === "history" && (
          <EmployeeHistoryScreen
            myScopedRuns={myScopedRuns}
            matchesSearch={matchesSearch}
            setSelectedRunId={setSelectedRunId}
            loadMyItems={loadMyItems}
            setActiveTab={setActiveTab}
            userName={userName}
          />
        )}

        {visibleTab === "execution" && (
          <ExecutionScreen
            runForm={runForm}
            setRunForm={setRunForm}
            startRun={startRun}
            scopedPlans={scopedPlans}
            selectedRunPlanIsAutomation={selectedRunPlanIsAutomation}
            selectedRun={selectedRun}
            myItems={safeMyItems}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            selectedItem={selectedItem}
            notes={notes}
            setNotes={setNotes}
            updateResult={updateResult}
            endRun={endRun}
            canEditSelectedRun={canEditSelectedRun}
            onLogBug={openJiraBugDialog}
          />
        )}
        </>
      )}
    </AppShell>
  );
}







