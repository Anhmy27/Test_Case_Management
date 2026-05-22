"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getId, userName } from "@/lib/api";
import ManualRunExecutionPanel from "./execution/ManualRunExecutionPanel";
import AutomationRunExecutionPanel from "./execution/AutomationRunExecutionPanel";

type RecordAny = Record<string, any>;

type WorkspaceProps = {
  workspace: Record<string, any>;
};

const adminNav = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "groups", label: "Groups" },
  { key: "test-cases", label: "Test Cases" },
  { key: "test-cases-detail", label: "Test Cases Detail" },
  { key: "versions", label: "Versions" },
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

function SectionCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div className="workspace-card__header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="workspace-inline-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
function DataTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
}) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="workspace-table">
      <div className="workspace-table__head" style={columnStyle}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="workspace-table__empty">{emptyText}</div>
      ) : (
        <div className="workspace-table__body">
          {rows.map((row, index) => (
            <div
              key={index}
              className="workspace-table__row"
              style={columnStyle}
            >
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function RoleWorkspace({ workspace }: WorkspaceProps) {
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
    groupForm,
    setGroupForm,
    testCaseForm,
    setTestCaseForm,
    automationForm,
    setAutomationForm,
    editingTestCaseId,
    startTestCaseEdit,
    cancelTestCaseEdit,
    saveTestCase,
    deleteTestCase,
    addTestCaseStep,
    updateTestCaseStep,
    removeTestCaseStep,
    addAutomationStep,
    updateAutomationStep,
    removeAutomationStep,
    planForm,
    setPlanForm,
    runForm,
    setRunForm,
    newUserForm,
    setNewUserForm,
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
    createVersion,
    createGroup,
    createPlan,
    createUser,
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
    resetWorkspaceDrafts,
    message,
  } = workspace;

  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState<string>("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string>("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!myItems.length) {
      setSelectedItemId("");
      return;
    }

    if (
      !selectedItemId ||
      !myItems.some((item: RecordAny) => item._id === selectedItemId)
    ) {
      setSelectedItemId(myItems[0]._id);
    }
  }, [myItems, selectedItemId]);

  const selectedItem = myItems.find(
    (item: RecordAny) => item._id === selectedItemId,
  );
  const currentUserId = String(currentUser?._id || "");
  const isAutomationRun = Boolean(
    selectedRun && selectedRun.testPlan && String(selectedRun.testPlan.executionMode) === "automation",
  );
  const selectedRunStartedByCurrentUser =
    String(selectedRun?.startedBy?._id || selectedRun?.startedBy || "") ===
    currentUserId;
  const canEditSelectedRun = Boolean(
    selectedRun &&
      selectedRun.status === "running" &&
      selectedRunStartedByCurrentUser &&
      !isAutomationRun,
  );

  const dashboardData = dashboard || {};
  const dashboardSummary = dashboardData.summary || {};
  const projectOverview = dashboardData.projectOverview || [];
  const selectedProject = projects.find(
    (project: RecordAny) => project._id === selectedProjectId,
  );
  const scopeLabel = selectedProject ? selectedProject.name : "All projects";
  const isGlobalScope = !selectedProjectId;
  const scopedProjects = isGlobalScope
    ? projects
    : selectedProject
      ? [selectedProject]
      : [];
  const scopedVersions = isGlobalScope
    ? versions
    : versions.filter(
        (version: RecordAny) => getId(version.project) === selectedProjectId,
      );
  const scopedGroups = isGlobalScope
    ? groups
    : groups.filter(
        (group: RecordAny) => getId(group.project) === selectedProjectId,
      );
  const scopedPlans = isGlobalScope
    ? plans
    : plans.filter(
        (plan: RecordAny) => getId(plan.project) === selectedProjectId,
      );
  const selectedRunPlan = scopedPlans.find(
    (plan: RecordAny) => String(plan._id) === String(runForm.testPlanId),
  );
  const selectedRunPlanIsAutomation =
    String(selectedRunPlan?.executionMode || "manual") === "automation";
  const scopedRuns = isGlobalScope
    ? runs
    : runs.filter(
        (run: RecordAny) => getId(run.testPlan?.project) === selectedProjectId,
      );
  const myScopedRuns = scopedRuns.filter(
    (run: RecordAny) =>
      String(run.startedBy?._id || run.startedBy || "") === currentUserId,
  );
  const adminRuns = isAdmin ? runs : scopedRuns;
  const navItems = isAdmin
    ? isGlobalScope
      ? adminNav.filter((item) =>
          ["dashboard", "projects", "users"].includes(item.key),
        )
      : adminNav.filter((item) => item.key !== "projects")
    : employeeNav;
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

  const totalProjects = projects.length;
  const totalPlans = plans.length;
  const totalCases = testCases.length;
  const totalUsers = users.length;
  const runningRuns = runs.filter((run: RecordAny) => run.status === "running");
  const runningRunsCount = runningRuns.length;
  const planProjectGroups = planForm.projectId
    ? groups.filter(
        (group: RecordAny) => getId(group.project) === planForm.projectId,
      )
    : [];
  const planProjectCases = planForm.projectId
    ? testCases.filter(
        (testCase: RecordAny) => getId(testCase.project) === planForm.projectId,
      )
    : [];
  const selectedPlanGroupIds = new Set(planForm.selectedGroupIds || []);
  const selectedPlanCaseIds = new Set(planForm.caseIds || []);
  const selectedPlanGroups = planProjectGroups.filter((group: RecordAny) =>
    selectedPlanGroupIds.has(String(group._id)),
  );
  const selectedPlanCasesByGroup = selectedPlanGroups.map((group: RecordAny) => {
    const groupId = String(group._id);
    return {
      group,
      cases: planProjectCases.filter(
        (testCase: RecordAny) => String(getId(testCase.group)) === groupId,
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
          (testCase: RecordAny) => String(testCase._id) === caseId,
        );

        return linkedCase && nextGroupSet.has(String(getId(linkedCase.group)));
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
      ? ["dashboard", "projects", "execution", "users"]
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
    if (!normalizedSearch) {
      return true;
    }

    return values.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <div className="workspace-brand__pill">TCM</div>
          <div>
            <strong>QA Workspace</strong>
            <p>{isAdmin ? "Admin role" : "Employee role"}</p>
          </div>
        </div>

        <div className="workspace-user">
          <div>
            <strong>{currentUser?.name}</strong>
            <p>{currentUser?.email}</p>
          </div>
          <span className="workspace-chip">{currentUser?.role}</span>
        </div>

        <div className="workspace-filter">
          <label>
            <span>Project scope</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((project: RecordAny) => (
                <option key={project._id} value={project._id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav className="workspace-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                visibleTab === item.key
                  ? "workspace-nav__item is-active"
                  : "workspace-nav__item"
              }
              onClick={() => {
                resetWorkspaceDrafts();
                setActiveTab(item.key as any);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="workspace-sidebar__footer">
          <button
            type="button"
            className="workspace-secondary"
            onClick={logout}
          >
            Dang xuat
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <section className="workspace-hero">
          <div className="workspace-hero__copy">
            <div className="workspace-hero__eyebrow">
              {isAdmin ? "Admin workspace" : "Employee workspace"}
            </div>
            <h1>{activeTabLabel}</h1>
            <p>
              Scope: <strong>{scopeLabel}</strong>
              {normalizedSearch ? (
                <>
                  {" "}
                  · Search: <strong>{searchTerm}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="workspace-hero__chips">
            <span className="workspace-chip workspace-chip--soft">
              {projects.length} projects
            </span>
            <span className="workspace-chip workspace-chip--soft">
              {plans.length} plans
            </span>
            <span className="workspace-chip workspace-chip--soft">
              {runs.length} runs
            </span>
          </div>
        </section>

        {message && <div className="workspace-banner">{message}</div>}

        <div className="workspace-toolbar">
          <label>
            <span>Search</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, code, key..."
            />
          </label>
        </div>

        {isAdmin && visibleTab === "dashboard" && (
          <div className="workspace-stack">
            {isGlobalScope ? (
              <>
                <SectionCard
                  title="Portfolio Overview"
                  subtitle="Tong quan tat ca project"
                >
                  <div className="workspace-metrics">
                    <MiniStat label="Projects" value={totalProjects} />
                    <MiniStat label="Test Plans" value={totalPlans} />
                    <MiniStat label="Test Cases" value={totalCases} />
                    <MiniStat label="Running Runs" value={runningRunsCount} />
                    <MiniStat label="Users" value={totalUsers} />
                  </div>
                </SectionCard>

                <div className="workspace-banner">
                  Chon 1 project de xem dashboard chi tiet theo test plan, fail
                  rate, va tester activity.
                </div>

                <div className="workspace-grid workspace-grid--two">
                  <SectionCard
                    title="Active Runs"
                    subtitle="Run dang chay tren tat ca project"
                  >
                    <DataTable
                      columns={["Run", "Project", "Tester", "Status"]}
                      rows={runningRuns.map((run: RecordAny) => (
                        <>
                          <div>{run.name || run.testPlan?.name || "Untitled"}</div>
                          <div>{run.project?.name || "-"}</div>
                          <div>{userName(run.startedBy)}</div>
                          <div>{run.status || "-"}</div>
                        </>
                      ))}
                      emptyText="No running test runs"
                    />
                  </SectionCard>

                  <SectionCard
                    title="Project Health"
                    subtitle="Progress va fail count theo project"
                  >
                    <DataTable
                      columns={["Project", "Progress", "Pass", "Fail"]}
                      rows={projectOverview
                        .filter((project: RecordAny) =>
                          matchesSearch(project.name, project.code),
                        )
                        .map((project: RecordAny) => (
                          <>
                            <div>{project.name}</div>
                            <div>{project.progress}%</div>
                            <div>{project.passCount}</div>
                            <div>{project.failCount}</div>
                          </>
                        ))}
                      emptyText="No project metrics"
                    />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Project Overview"
                  subtitle="Version moi nhat, pass/fail, progress"
                >
                  <DataTable
                    columns={[
                      "Project",
                      "Latest Version",
                      "Pass",
                      "Fail",
                      "Progress",
                    ]}
                    rows={projectOverview
                      .filter((project: RecordAny) =>
                        matchesSearch(
                          project.name,
                          project.code,
                          project.latestVersion,
                        ),
                      )
                      .map((project: RecordAny) => (
                        <>
                          <div>{project.name}</div>
                          <div>{project.latestVersion}</div>
                          <div>{project.passCount}</div>
                          <div>{project.failCount}</div>
                          <div>{project.progress}%</div>
                        </>
                      ))}
                    emptyText="No projects found"
                  />
                </SectionCard>
              </>
            ) : (
              <>
                <SectionCard
                  title="Admin Dashboard"
                  subtitle="Theo doi tien do, loi va tester activity"
                >
                  <div className="workspace-metrics">
                    <MiniStat
                      label="Running Test Runs"
                      value={dashboardSummary.runningRuns || 0}
                    />
                    <MiniStat
                      label="Total Cases"
                      value={dashboardSummary.totalCases || 0}
                    />
                    <MiniStat
                      label="Executed"
                      value={dashboardSummary.executed || 0}
                    />
                    <MiniStat
                      label="Pass Rate"
                      value={`${dashboardSummary.passRate || 0}%`}
                    />
                  </div>
                </SectionCard>

                <div className="workspace-grid workspace-grid--two">
                  <SectionCard
                    title="Running Test Runs"
                    subtitle="Ai dang test, plan nao dang chay"
                  >
                    <DataTable
                      columns={["Tester", "Test Plan", "Progress", "Status"]}
                      rows={(dashboardData.runningTestRuns || [])
                        .filter((run: RecordAny) =>
                          matchesSearch(
                            run.testPlan?.name,
                            run.name,
                            userName(run.startedBy),
                          ),
                        )
                        .map((run: RecordAny) => (
                          <>
                            <div>{userName(run.startedBy)}</div>
                            <div>{run.testPlan?.name || run.name}</div>
                            <div>
                              {run.progress ??
                                `${run.results?.length || 0} cases`}
                            </div>
                            <div className="workspace-pill workspace-pill--success">
                              Running
                            </div>
                          </>
                        ))}
                      emptyText="No running test runs"
                    />
                  </SectionCard>

                  <SectionCard
                    title="Delayed Test Plans"
                    subtitle="Da assign nhung chua start"
                  >
                    <DataTable
                      columns={["Test Plan", "Project", "Owner"]}
                      rows={(dashboardData.delayedTestPlans || [])
                        .filter((plan: RecordAny) =>
                          matchesSearch(
                            plan.name,
                            plan.project?.name,
                            userName(plan.owner),
                          ),
                        )
                        .map((plan: RecordAny) => (
                          <>
                            <div>{plan.name}</div>
                            <div>{plan.project?.name || "-"}</div>
                            <div>{userName(plan.owner)}</div>
                          </>
                        ))}
                      emptyText="No delayed plans"
                    />
                  </SectionCard>
                </div>

                <div className="workspace-grid workspace-grid--two">
                  <SectionCard
                    title="Most Failed Test Cases"
                    subtitle="Test case fail nhieu nhat"
                  >
                    <DataTable
                      columns={["Case", "Priority", "Fails"]}
                      rows={(dashboardData.mostFailedTestCases || [])
                        .filter((item: RecordAny) =>
                          matchesSearch(
                            item.caseKey,
                            item.title,
                            item.priority,
                          ),
                        )
                        .map((item: RecordAny) => (
                          <>
                            <div>
                              {item.caseKey} - {item.title}
                            </div>
                            <div>{item.priority}</div>
                            <div>{item.failCount}</div>
                          </>
                        ))}
                      emptyText="No failing cases"
                    />
                  </SectionCard>

                  <SectionCard
                    title="Tester Activity"
                    subtitle="Pass / fail theo tester"
                  >
                    <DataTable
                      columns={["Tester", "Total", "Pass", "Fail"]}
                      rows={(dashboardData.testerActivity || [])
                        .filter((item: RecordAny) =>
                          matchesSearch(item.name, item.email),
                        )
                        .map((item: RecordAny) => (
                          <>
                            <div>{item.name}</div>
                            <div>{item.totalTests}</div>
                            <div>{item.passCount}</div>
                            <div>{item.failCount}</div>
                          </>
                        ))}
                      emptyText="No tester activity"
                    />
                  </SectionCard>
                </div>

                <SectionCard
                  title="Project Overview"
                  subtitle="Tong pass/fail, version moi nhat, progress"
                >
                  <DataTable
                    columns={[
                      "Project",
                      "Latest Version",
                      "Pass",
                      "Fail",
                      "Progress",
                    ]}
                    rows={projectOverview
                      .filter((project: RecordAny) =>
                        matchesSearch(
                          project.name,
                          project.code,
                          project.latestVersion,
                        ),
                      )
                      .map((project: RecordAny) => (
                        <>
                          <div>{project.name}</div>
                          <div>{project.latestVersion}</div>
                          <div>{project.passCount}</div>
                          <div>{project.failCount}</div>
                          <div>{project.progress}%</div>
                        </>
                      ))}
                    emptyText="No projects found"
                  />
                </SectionCard>
              </>
            )}
          </div>
        )}

        {isAdmin && visibleTab === "projects" && (
          <div className="workspace-stack">
            <SectionCard
              title={editingProjectId ? "Edit Project" : "Projects"}
              subtitle="Tao, sua, xoa project trong mot workspace rieng"
            >
              <form className="workspace-form" onSubmit={saveProject}>
                <div className="workspace-form__grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={projectForm.name}
                      onChange={(e) =>
                        setProjectForm((prev: any) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Code</span>
                    <input
                      value={projectForm.code}
                      onChange={(e) =>
                        setProjectForm((prev: any) => ({
                          ...prev,
                          code: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={projectForm.description}
                    onChange={(e) =>
                      setProjectForm((prev: any) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <div className="workspace-inline-actions">
                  <button className="workspace-primary" type="submit">
                    {editingProjectId ? "Save project" : "Create project"}
                  </button>
                  {editingProjectId && (
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={cancelProjectEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </SectionCard>

            <SectionCard title="Project List" subtitle="Card/table sach, riang">
              <DataTable
                columns={["Project", "Code", "Action"]}
                rows={projects
                  .filter((project: RecordAny) =>
                    matchesSearch(project.name, project.code),
                  )
                  .map((project: RecordAny) => (
                    <>
                      <div>{project.name}</div>
                      <div>{project.code}</div>
                      <div className="workspace-inline-actions">
                        <button
                          type="button"
                          className="workspace-secondary"
                          onClick={() => startProjectEdit(project)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="workspace-danger"
                          onClick={() => deleteProject(project._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No projects"
              />
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "groups" && (
          <div className="workspace-stack">
            <SectionCard
              title="Test Case Groups"
              subtitle="Tao nhom test case trong section rieng"
            >
              <form className="workspace-form" onSubmit={createGroup}>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Project</span>
                    <select
                      value={groupForm.projectId}
                      onChange={(e) =>
                        setGroupForm((prev: any) => ({
                          ...prev,
                          projectId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedProjects.map((project: RecordAny) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Name</span>
                    <input
                      value={groupForm.name}
                      onChange={(e) =>
                        setGroupForm((prev: any) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={groupForm.description}
                    onChange={(e) =>
                      setGroupForm((prev: any) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <button className="workspace-primary" type="submit">
                  Create group
                </button>
              </form>
            </SectionCard>

            <SectionCard title="Group List" subtitle="Nhom theo project">
              <DataTable
                columns={["Group", "Project", "Description"]}
                rows={groups
                  .filter((group: RecordAny) =>
                    matchesSearch(
                      group.name,
                      group.project?.name,
                      group.description,
                    ),
                  )
                  .map((group: RecordAny) => (
                    <>
                      <div>{group.name}</div>
                      <div>{group.project?.name || "-"}</div>
                      <div>{group.description || "-"}</div>
                    </>
                  ))}
                emptyText="No groups"
              />
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "test-cases" && (
          <div className="workspace-stack">
            <SectionCard
              title={editingTestCaseId ? "Edit Test Case" : "Test Cases"}
              subtitle="Quan ly test case trong panel rieng"
              actions={
                <>
                  <button
                    type="button"
                    className="workspace-secondary"
                    onClick={downloadTestCaseTemplate}
                  >
                    Download Excel Template
                  </button>
                  <button
                    type="button"
                    className="workspace-primary"
                    onClick={() => importInputRef.current?.click()}
                    disabled={!selectedProjectId}
                  >
                    Import Excel
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: "none" }}
                    onChange={async (event) => {
                      const input = event.currentTarget as HTMLInputElement;
                      const file = input.files?.[0];
                      if (!file) {
                        return;
                      }

                      await importTestCases(file);
                      // clear the input value by mutating the element directly
                      input.value = "";
                    }}
                  />
                </>
              }
            >              <form className="workspace-form" onSubmit={saveTestCase}>
                <div className="workspace-form__grid workspace-form__grid--three">
                  <label>
                    <span>Project</span>
                    <select
                      value={testCaseForm.projectId}
                      onChange={(e) =>
                        setTestCaseForm((prev: any) => ({
                          ...prev,
                          projectId: e.target.value,
                          groupId: "",
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedProjects.map((project: RecordAny) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Group</span>
                    <select
                      value={testCaseForm.groupId}
                      onChange={(e) =>
                        setTestCaseForm((prev: any) => ({
                          ...prev,
                          groupId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedGroups.map((group: RecordAny) => (
                        <option key={group._id} value={group._id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Case Key</span>
                    <input
                      value={testCaseForm.caseKey}
                      onChange={(e) =>
                        setTestCaseForm((prev: any) => ({
                          ...prev,
                          caseKey: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Title</span>
                  <input
                    value={testCaseForm.title}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={testCaseForm.priority || "medium"}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
                <label>
                  <span>Severity</span>
                  <select
                    value={testCaseForm.severity || "major"}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        severity: e.target.value,
                      }))
                    }
                  >
                    <option value="minor">minor</option>
                    <option value="major">major</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={testCaseForm.type || "functional"}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                  >
                    <option value="functional">functional</option>
                    <option value="api">api</option>
                    <option value="ui">ui</option>
                    <option value="regression">regression</option>
                    <option value="security">security</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={testCaseForm.description}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <div className="workspace-steps">
                  <div className="workspace-steps__header">
                    <span>Steps</span>
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={addTestCaseStep}
                    >
                      Add step
                    </button>
                  </div>
                  {testCaseForm.steps.map((step: RecordAny, index: number) => (
                    <div className="workspace-steps__row" key={index}>
                      <span className="workspace-steps__index">
                        {index + 1}
                      </span>
                      <input
                        value={step.action}
                        onChange={(e) =>
                          updateTestCaseStep(index, "action", e.target.value)
                        }
                        placeholder="Step action"
                      />
                      <button
                        type="button"
                        className="workspace-secondary"
                        onClick={() => removeTestCaseStep(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <label>
                  <span>Expected result</span>
                  <input
                    value={testCaseForm.expected}
                    onChange={(e) =>
                      setTestCaseForm((prev: any) => ({
                        ...prev,
                        expected: e.target.value,
                      }))
                    }
                    required
                  />
                  <div className="workspace-banner">
                    Manual steps stay for human-readable QA flow. Turn on automation below to store Playwright steps for the same test case.
                  </div>
                  <div className="workspace-form__grid workspace-form__grid--two">
                    <label>
                      <span>Automation enabled</span>
                      <select
                        value={automationForm.enabled ? "true" : "false"}
                        onChange={(e) =>
                          setAutomationForm((prev: any) => ({
                            ...prev,
                            enabled: e.target.value === "true",
                          }))
                        }
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </label>
                    <label>
                      <span>Base URL</span>
                      <input
                        value={automationForm.baseUrl}
                        onChange={(e) =>
                          setAutomationForm((prev: any) => ({
                            ...prev,
                            baseUrl: e.target.value,
                          }))
                        }
                        placeholder="https://app.example.com"
                      />
                    </label>
                  </div>
                  <div className="workspace-form__grid workspace-form__grid--two">
                    <label>
                      <span>User (email/username)</span>
                      <input
                        value={automationForm.userKey}
                        onChange={(e) =>
                          setAutomationForm((prev: any) => ({
                            ...prev,
                            userKey: e.target.value,
                          }))
                        }
                        placeholder="tester@company.com"
                      />
                    </label>
                  </div>
                  <div className="workspace-steps">
                    <div className="workspace-steps__header">
                      <span>Playwright steps</span>
                      <button
                        type="button"
                        className="workspace-secondary"
                        onClick={addAutomationStep}
                      >
                        Add automation step
                      </button>
                    </div>
                    {automationForm.steps.map((step: RecordAny, index: number) => (
                      <div key={index} className="workspace-automation-step">
                        <div className="workspace-form__grid workspace-form__grid--three">
                          <label>
                            <span>Action</span>
                            <select
                              value={step.action}
                              onChange={(e) =>
                                updateAutomationStep(index, "action", e.target.value)
                              }
                            >
                              <option value="goto">goto</option>
                              <option value="click">click</option>
                              <option value="type">type</option>
                              <option value="select">select</option>
                              <option value="waitFor">waitFor</option>
                              <option value="assertText">assertText</option>
                              <option value="assertVisible">assertVisible</option>
                              <option value="assertUrl">assertUrl</option>
                              <option value="assertTitle">assertTitle</option>
                              <option value="assertHidden">assertHidden</option>
                              <option value="assertEnabled">assertEnabled</option>
                              <option value="assertChecked">assertChecked</option>
                              <option value="hover">hover</option>
                              <option value="press">press</option>
                              <option value="upload">upload</option>
                              <option value="dragTo">dragTo</option>
                            </select>
                          </label>
                          <label>
                            <span>Target type</span>
                            <select
                              value={step.targetType}
                              onChange={(e) =>
                                updateAutomationStep(index, "targetType", e.target.value)
                              }
                            >
                              <option value="css">css</option>
                              <option value="id">id</option>
                              <option value="placeholder">placeholder</option>
                              <option value="text">text</option>
                              <option value="label">label</option>
                              <option value="testid">testid</option>
                              <option value="url">url</option>
                            </select>
                          </label>
                          <label>
                            <span>Timeout ms</span>
                            <input
                              type="number"
                              min="0"
                              value={step.timeoutMs}
                              onChange={(e) =>
                                updateAutomationStep(index, "timeoutMs", e.target.value)
                              }
                            />
                          </label>
                        </div>
                        <div className="workspace-form__grid workspace-form__grid--three">
                          <label>
                            <span>Target</span>
                            <input
                              value={step.target}
                              onChange={(e) =>
                                updateAutomationStep(index, "target", e.target.value)
                              }
                              placeholder="#login-button / email / Username / submit-btn"
                            />
                          </label>
                          <label>
                            <span>Value</span>
                            <input
                              value={step.value}
                              onChange={(e) =>
                                updateAutomationStep(index, "value", e.target.value)
                              }
                              placeholder="Text to type, option value, path, key combo, file path, drop target..."
                            />
                          </label>
                          <label>
                            <span>Expected</span>
                            <input
                              value={step.expected}
                              onChange={(e) =>
                                updateAutomationStep(index, "expected", e.target.value)
                              }
                              placeholder="Text, title or URL fragment to assert"
                            />
                          </label>
                        </div>
                        <div className="workspace-inline-actions workspace-inline-actions--right">
                          <button
                            type="button"
                            className="workspace-secondary"
                            onClick={() => removeAutomationStep(index)}
                          >
                            Remove automation step
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </label>
                <div className="workspace-inline-actions">
                  <button className="workspace-primary" type="submit">
                    {editingTestCaseId ? "Save test case" : "Create test case"}
                  </button>
                  {editingTestCaseId && (
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={cancelTestCaseEdit}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Test Case List"
              subtitle="Khong gom form CRUD tren cung mot page"
            >
              <DataTable
                columns={["Case", "Project", "Group", "Action"]}
                rows={testCases
                  .filter((testCase: RecordAny) =>
                    matchesSearch(
                      testCase.caseKey,
                      testCase.title,
                      testCase.project?.name,
                      testCase.group?.name,
                    ),
                  )
                  .map((testCase: RecordAny) => (
                    <>
                      <div>
                        {testCase.caseKey} - {testCase.title}
                      </div>
                      <div>{testCase.project?.name || "-"}</div>
                      <div>{testCase.group?.name || "-"}</div>
                      <div className="workspace-inline-actions">
                        <button
                          type="button"
                          className="workspace-secondary"
                          onClick={() => startTestCaseEdit(testCase)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="workspace-danger"
                          onClick={() => deleteTestCase(testCase._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No test cases"
              />
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "test-cases-detail" && (
          <div className="workspace-stack">
            {!selectedProjectId ? (
              <div className="workspace-banner">
                Hay chon project trong Project scope de xem Test Cases Detail.
              </div>
            ) : (
              <>
                <SectionCard
                  title="Test Cases Detail"
                  subtitle="Loc theo group va xem 3 status pass/fail/blocked/skip gan nhat"
                >
                  <div className="workspace-form__grid workspace-form__grid--two">
                    <label>
                      <span>Group filter</span>
                      <select
                        value={detailGroupId}
                        onChange={(e) => setDetailGroupId(e.target.value)}
                      >
                        <option value="">All groups</option>
                        {scopedGroups.map((group: RecordAny) => (
                          <option key={group._id} value={group._id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </SectionCard>

                <SectionCard title="Test Case List">
                  {detailLoading ? (
                    <div className="workspace-table__empty">Loading...</div>
                  ) : (
                    <DataTable
                      columns={[
                        "Case",
                        "Group",
                        "Priority",
                        "Recent 1",
                        "Recent 2",
                        "Recent 3",
                      ]}
                      rows={detailRows
                        .filter((testCase: RecordAny) =>
                          matchesSearch(
                            testCase.caseKey,
                            testCase.title,
                            testCase.group?.name,
                            testCase.priority,
                            ...(testCase.recentStatuses || []),
                          ),
                        )
                        .map((testCase: RecordAny) => {
                          const statuses = Array.isArray(testCase.recentStatuses)
                            ? testCase.recentStatuses
                            : [];

                          const statusCell = (status?: string) => (
                            <span
                              className={
                                status
                                  ? `workspace-pill status-${status}`
                                  : "workspace-pill"
                              }
                            >
                              {status || "-"}
                            </span>
                          );

                          return (
                            <>
                              <div>
                                {testCase.caseKey || testCase.key} - {testCase.title || testCase.name}
                              </div>
                              <div>{testCase.group?.name || "-"}</div>
                              <div>{testCase.priority || "-"}</div>
                              <div>{statusCell(statuses[0])}</div>
                              <div>{statusCell(statuses[1])}</div>
                              <div>{statusCell(statuses[2])}</div>
                            </>
                          );
                        })}
                      emptyText="No test cases in this project"
                    />
                  )}
                </SectionCard>
              </>
            )}
          </div>
        )}

        {isAdmin && visibleTab === "versions" && (
          <div className="workspace-stack">
            <SectionCard
              title="Versions"
              subtitle="Tao version trong workspace rieng"
            >
              <form className="workspace-form" onSubmit={createVersion}>
                <div className="workspace-form__grid workspace-form__grid--three">
                  <label>
                    <span>Project</span>
                    <select
                      value={versionForm.projectId}
                      onChange={(e) =>
                        setVersionForm((prev: any) => ({
                          ...prev,
                          projectId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedProjects.map((project: RecordAny) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Name</span>
                    <input
                      value={versionForm.name}
                      onChange={(e) =>
                        setVersionForm((prev: any) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Release date</span>
                    <input
                      type="date"
                      value={versionForm.releaseDate}
                      onChange={(e) =>
                        setVersionForm((prev: any) => ({
                          ...prev,
                          releaseDate: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button className="workspace-primary" type="submit">
                  Create version
                </button>
              </form>
            </SectionCard>

            <SectionCard title="Version List">
              <DataTable
                columns={["Version", "Project"]}
                rows={versions
                  .map((version: RecordAny) => {
                    const pid = getId(version.project);
                    const proj = projects.find((p: RecordAny) => String(p._id) === pid);
                    const projectName = proj?.name || pid || "-";
                    return { version, projectName };
                  })
                  .filter(({ version, projectName }: { version: RecordAny; projectName: string }) =>
                    matchesSearch(version.name, projectName),
                  )
                  .map(({ version, projectName }: { version: RecordAny; projectName: string }) => (
                    <>
                      <div>{version.name}</div>
                      <div>{projectName}</div>
                    </>
                  ))}
                emptyText="No versions"
              />
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "test-plans" && (
          <div className="workspace-stack">
            <SectionCard
              title="Test Plans"
              subtitle="Assign user va tao plan rieng biet"
            >
              <form className="workspace-form" onSubmit={createPlan}>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Project</span>
                    <select
                      value={planForm.projectId}
                      onChange={(e) =>
                        setPlanForm((prev: any) => ({
                          ...prev,
                          projectId: e.target.value,
                          versionId: "",
                          selectedGroupIds: [],
                          caseIds: [],
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedProjects.map((project: RecordAny) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Version</span>
                    <select
                      value={planForm.versionId}
                      onChange={(e) =>
                        setPlanForm((prev: any) => ({
                          ...prev,
                          versionId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select</option>
                      {scopedVersions
                        .filter(
                          (version: RecordAny) =>
                            getId(version.project) === planForm.projectId,
                        )
                        .map((version: RecordAny) => (
                          <option key={version._id} value={version._id}>
                            {version.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Execution Mode</span>
                  <select
                    value={planForm.executionMode || "manual"}
                    onChange={(e) =>
                      setPlanForm((prev: any) => ({
                        ...prev,
                        executionMode: e.target.value,
                      }))
                    }
                  >
                    <option value="manual">Manual</option>
                    <option value="automation">Automation</option>
                  </select>
                </label>
                <label>
                  <span>Name</span>
                  <input
                    value={planForm.name}
                    onChange={(e) =>
                      setPlanForm((prev: any) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={planForm.description}
                    onChange={(e) =>
                      setPlanForm((prev: any) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Groups</span>
                  <div className="workspace-checklist">
                    {planProjectGroups.length === 0 ? (
                      <div className="workspace-checklist__empty">
                        Chon project truoc de lay danh sach group.
                      </div>
                    ) : (
                      planProjectGroups.map((group: RecordAny) => {
                        const groupId = String(group._id);
                        const checked = selectedPlanGroupIds.has(groupId);
                        const groupCaseCount = planProjectCases.filter(
                          (testCase: RecordAny) =>
                            String(getId(testCase.group)) === groupId,
                        ).length;

                        return (
                          <label
                            key={groupId}
                            className={`workspace-checklist__item${checked ? " is-checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePlanGroup(groupId)}
                            />
                            <span>
                              <strong>{group.name}</strong>
                              <small>{groupCaseCount} test cases</small>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </label>
                <div className="workspace-checklist__panel">
                  <div className="workspace-checklist__panel-header">
                    <div>
                      <span>Test cases</span>
                      <p>
                        Chon nhieu test case tu cac group khac nhau bang checkbox.
                      </p>
                    </div>
                    <strong>{planForm.caseIds.length} selected</strong>
                  </div>
                  {selectedPlanGroups.length === 0 ? (
                    <div className="workspace-checklist__empty">
                      Chon it nhat 1 group de hien test case.
                    </div>
                  ) : (
                    selectedPlanCasesByGroup.map(({ group, cases }: RecordAny) => {
                      const groupId = String(group._id);

                      return (
                        <div key={groupId} className="workspace-checklist__group">
                          <div className="workspace-checklist__group-header">
                            <strong>{group.name}</strong>
                            <span>{cases.length} cases</span>
                          </div>
                          <div className="workspace-checklist__case-list">
                            {cases.length === 0 ? (
                              <div className="workspace-checklist__empty workspace-checklist__empty--inline">
                                Group nay chua co test case.
                              </div>
                            ) : (
                              cases.map((testCase: RecordAny) => {
                                const caseId = String(testCase._id);
                                const checked = selectedPlanCaseIds.has(caseId);

                                return (
                                  <label
                                    key={caseId}
                                    className={`workspace-checklist__case${checked ? " is-checked" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        togglePlanCase(groupId, caseId)
                                      }
                                    />
                                    <span>
                                      <strong>
                                        {testCase.caseKey} - {testCase.title}
                                      </strong>
                                      {testCase.description ? (
                                        <small>{testCase.description}</small>
                                      ) : (
                                        <small>Khong co mo ta</small>
                                      )}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <button className="workspace-primary" type="submit">
                  Create test plan
                </button>
              </form>
            </SectionCard>

            <SectionCard
              title="Assign Assignees"
              subtitle="Owner se tu dong la admin dang thao tac"
            >
              <form className="workspace-form" onSubmit={saveAssignments}>
                <label>
                  <span>Test Plan</span>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => selectPlanForAssignment(e.target.value)}
                    required
                  >
                    <option value="">Select plan</option>
                    {scopedPlans.map((plan: RecordAny) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Assignees</span>
                    <select
                      multiple
                      value={assignDraft.assigneeIds}
                      onChange={(e) =>
                        setAssignDraft((prev: any) => ({
                          ...prev,
                          assigneeIds: Array.from(e.target.selectedOptions).map(
                            (option) => option.value,
                          ),
                        }))
                      }
                    >
                      {users.map((user: RecordAny) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.role})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="workspace-banner">
                  Owner will be saved as <strong>{currentUser?.name}</strong> (
                  {currentUser?.role}).
                </div>
                <button className="workspace-primary" type="submit">
                  Save assignment
                </button>
              </form>
            </SectionCard>

            <SectionCard title="Test Plan List">
              {editingPlanId ? (
                <div className="workspace-form">
                  <label>
                    <span>Execution Mode</span>
                    <select
                      value={editingExecutionMode}
                      onChange={(e) => setEditingExecutionMode(e.target.value)}
                    >
                      <option value="manual">Manual</option>
                      <option value="automation">Automation</option>
                    </select>
                  </label>
                  <div className="workspace-inline-actions">
                    <button
                      type="button"
                      className="workspace-primary"
                      onClick={() => {
                        if (editingExecutionMode) {
                          updatePlanExecutionMode(editingPlanId, editingExecutionMode);
                        }
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={() => {
                        setEditingPlanId("");
                        setEditingExecutionMode("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <DataTable
                  columns={["Plan", "Project", "Version", "Owner", "Mode", "Action"]}
                  rows={scopedPlans
                    .filter((plan: RecordAny) =>
                      matchesSearch(
                        plan.name,
                        plan.project?.name,
                        plan.version?.name,
                        userName(plan.owner),
                      ),
                    )
                    .map((plan: RecordAny) => (
                      <>
                        <div>{plan.name}</div>
                        <div>{plan.project?.name || "-"}</div>
                        <div>{plan.version?.name || "-"}</div>
                        <div>{userName(plan.owner)}</div>
                        <div>
                          <span className="workspace-pill">
                            {plan.executionMode || 'manual'}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="workspace-secondary"
                            onClick={() => {
                              setEditingPlanId(plan._id);
                              setEditingExecutionMode(plan.executionMode || 'manual');
                            }}
                          >
                            Update
                          </button>
                        </div>
                      </>
                    ))}
                  emptyText="No plans"
                />
              )}
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "test-runs" && (
          <div className="workspace-stack">
            <SectionCard
              title="Test Runs"
              subtitle="Theo doi execution va start/end run rieng"
            >
              <form className="workspace-form" onSubmit={startRun}>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Test Plan</span>
                    <select
                      value={runForm.testPlanId}
                      onChange={(e) =>
                        setRunForm((prev: any) => ({
                          ...prev,
                          testPlanId: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select plan</option>
                      {scopedPlans.map((plan: RecordAny) => (
                        <option key={plan._id} value={plan._id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Run name</span>
                    <input
                      value={runForm.name}
                      onChange={(e) =>
                        setRunForm((prev: any) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Automation base URL</span>
                  <input
                    value={runForm.baseUrl || ""}
                    onChange={(e) =>
                      setRunForm((prev: any) => ({
                        ...prev,
                        baseUrl: e.target.value,
                      }))
                    }
                    placeholder="https://app.example.com"
                  />
                </label>
                {selectedRunPlanIsAutomation && (
                  <div className="workspace-banner">
                    Automation plan đã được chọn. Khi bạn start run, Playwright sẽ chạy ngay với base URL này.
                  </div>
                )}
                <button className="workspace-primary" type="submit">
                  Start test run
                </button>
              </form>
            </SectionCard>

            <SectionCard
              title="Test Run List"
              subtitle="Start / completed runs"
            >
              <DataTable
                columns={["Run", "Plan", "Started by", "Status", "Action"]}
                rows={adminRuns
                  .filter((run: RecordAny) =>
                    matchesSearch(
                      run.name,
                      run.testPlan?.name,
                      userName(run.startedBy),
                      run.status,
                    ),
                  )
                  .map((run: RecordAny) => (
                    <>
                      <div>{run.name}</div>
                      <div>{run.testPlan?.name || "-"}</div>
                      <div>{userName(run.startedBy)}</div>
                      <div
                        className={
                          run.status === "running"
                            ? "workspace-pill workspace-pill--success"
                            : "workspace-pill"
                        }
                      >
                        {run.status}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="workspace-secondary"
                          onClick={async () => {
                            setSelectedRunId(run._id);
                            await loadMyItems(run._id);
                            setActiveTab("execution");
                          }}
                        >
                          {run.status === "running" && String(run.startedBy?._id || run.startedBy || "") === currentUserId ? "Open" : "View"}
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No runs"
              />
            </SectionCard>
          </div>
        )}

        {isAdmin && visibleTab === "users" && (
          <div className="workspace-stack">
            <SectionCard title="Users" subtitle="Quan ly user, role va assign">
              <form className="workspace-form" onSubmit={createUser}>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Name</span>
                    <input
                      value={newUserForm.name}
                      onChange={(e) =>
                        setNewUserForm((prev: any) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={newUserForm.email}
                      onChange={(e) =>
                        setNewUserForm((prev: any) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                <div className="workspace-form__grid workspace-form__grid--two">
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) =>
                        setNewUserForm((prev: any) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select
                      value={newUserForm.role}
                      onChange={(e) =>
                        setNewUserForm((prev: any) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                    >
                      <option value="employee">employee</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                </div>
                <button className="workspace-primary" type="submit">
                  Create user
                </button>
              </form>
            </SectionCard>

            <SectionCard title="User List">
              <DataTable
                columns={["User", "Email", "Role"]}
                rows={users
                  .filter((user: RecordAny) =>
                    matchesSearch(user.name, user.email, user.role),
                  )
                  .map((user: RecordAny) => (
                    <>
                      <div>{user.name}</div>
                      <div>{user.email}</div>
                      <div>{user.role}</div>
                    </>
                  ))}
                emptyText="No users"
              />
            </SectionCard>
          </div>
        )}

        {!isAdmin && visibleTab === "my-test-plans" && (
          <div className="workspace-stack">
            <SectionCard
              title="My Test Plans"
              subtitle="Click vao test plan de vao run test"
            >
              <DataTable
                columns={[
                  "Test Plan",
                  "Project",
                  "Version",
                  "Status",
                  "Progress",
                  "Action",
                ]}
                rows={scopedPlans
                  .filter((plan: RecordAny) =>
                    matchesSearch(
                      plan.name,
                      plan.project?.name,
                      plan.version?.name,
                      plan.status,
                    ),
                  )
                  .map((plan: RecordAny) => (
                    <>
                      <div>{plan.name}</div>
                      <div>{plan.project?.name || "-"}</div>
                      <div>{plan.version?.name || "-"}</div>
                      <div>{plan.status}</div>
                      <div>
                        {plan.progress?.toFixed?.(1) ?? plan.progress ?? 0}%
                      </div>
                      <div>
                        <button
                          type="button"
                          className="workspace-primary"
                          onClick={() => {
                            setRunForm((prev: RecordAny) => ({
                              ...prev,
                              testPlanId: plan._id,
                            }));
                            setActiveTab("execution");
                          }}
                        >
                          Run
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No assigned plans"
              />
            </SectionCard>
          </div>
        )}

        {!isAdmin && visibleTab === "running-tests" && (
          <div className="workspace-stack">
            <SectionCard title="Running Tests" subtitle="Run dang chay cua ban">
              <DataTable
                columns={["Run", "Plan", "Status", "Action"]}
                rows={myScopedRuns
                  .filter((run: RecordAny) => run.status === "running")
                  .filter((run: RecordAny) =>
                    matchesSearch(run.name, run.testPlan?.name, run.status),
                  )
                  .map((run: RecordAny) => (
                    <>
                      <div>{run.name}</div>
                      <div>{run.testPlan?.name || "-"}</div>
                      <div>{run.status}</div>
                      <div>
                        <button
                          type="button"
                          className="workspace-secondary"
                          onClick={async () => {
                            setSelectedRunId(run._id);
                            await loadMyItems(run._id);
                            setActiveTab("execution");
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No running tests"
              />
            </SectionCard>
          </div>
        )}

        {!isAdmin && visibleTab === "history" && (
          <div className="workspace-stack">
            <SectionCard title="History" subtitle="Lich su execution">
              <DataTable
                columns={["Run", "Plan", "Status", "Started By", "Action"]}
                rows={myScopedRuns
                  .filter((run: RecordAny) => run.status === "completed")
                  .filter((run: RecordAny) =>
                    matchesSearch(
                      run.name,
                      run.testPlan?.name,
                      run.status,
                      userName(run.startedBy),
                    ),
                  )
                  .map((run: RecordAny) => (
                    <>
                      <div>{run.name}</div>
                      <div>{run.testPlan?.name || "-"}</div>
                      <div>{run.status}</div>
                      <div>{userName(run.startedBy)}</div>
                      <div>
                        <button
                          type="button"
                          className="workspace-secondary"
                          onClick={async () => {
                            setSelectedRunId(run._id);
                            await loadMyItems(run._id);
                            setActiveTab("execution");
                          }}
                        >
                          View
                        </button>
                      </div>
                    </>
                  ))}
                emptyText="No history yet"
              />
            </SectionCard>
          </div>
        )}

        {visibleTab === "execution" && (
          <div className="execution-workspace">
            <div className="execution-workspace__top">
              <SectionCard
                title="Start Test Run"
                subtitle="Admin co the run moi test plan, assignee chi run plan duoc assign"
              >
                <form className="workspace-form" onSubmit={startRun}>
                  <div className="workspace-form__grid workspace-form__grid--two">
                    <label>
                      <span>Test Plan</span>
                      <select
                        value={runForm.testPlanId}
                        onChange={(e) =>
                          setRunForm((prev: any) => ({
                            ...prev,
                            testPlanId: e.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select plan</option>
                        {scopedPlans.map((plan: RecordAny) => (
                          <option key={plan._id} value={plan._id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Run name</span>
                      <input
                        value={runForm.name}
                        onChange={(e) =>
                          setRunForm((prev: any) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  </div>
                  <label>
                    <span>Automation base URL</span>
                    <input
                      value={runForm.baseUrl || ""}
                      onChange={(e) =>
                        setRunForm((prev: any) => ({
                          ...prev,
                          baseUrl: e.target.value,
                        }))
                      }
                      placeholder="https://app.example.com"
                    />
                  </label>
                  {selectedRunPlanIsAutomation && (
                    <div className="workspace-banner">
                      Playwright sẽ chạy ngay khi bạn start run cho plan automation này.
                    </div>
                  )}
                  <button className="workspace-primary" type="submit">
                    Start run
                  </button>
                </form>
              </SectionCard>
            </div>

            {selectedRun ? (
              selectedRun.testPlan && String(selectedRun.testPlan.executionMode) === "automation" ? (
                <AutomationRunExecutionPanel
                  selectedRun={selectedRun}
                  myItems={myItems}
                  selectedItemId={selectedItemId}
                  setSelectedItemId={setSelectedItemId}
                  selectedItem={selectedItem}
                  notes={notes}
                  setNotes={setNotes}
                />
              ) : (
                <ManualRunExecutionPanel
                  selectedRun={selectedRun}
                  myItems={myItems}
                  selectedItemId={selectedItemId}
                  setSelectedItemId={setSelectedItemId}
                  selectedItem={selectedItem}
                  notes={notes}
                  setNotes={setNotes}
                  onUpdateResult={updateResult}
                  onEndRun={() => endRun(selectedRun._id)}
                  canEditRun={canEditSelectedRun}
                />
              )
            ) : (
              <div className="workspace-note">
                Chon hoac start mot test run de bat dau execution.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}





