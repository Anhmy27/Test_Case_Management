"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import { ActionButton, Button, Field, INPUT_CLS } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  planForm: any;
  setPlanForm: Dispatch<SetStateAction<any>>;
  createPlan: (event: FormEvent) => Promise<boolean>;
  scopedProjects: RecordAny[];
  scopedVersions: RecordAny[];
  planProjectGroups: RecordAny[];
  planProjectCases: RecordAny[];
  selectedPlanGroupIds: Set<any>;
  selectedPlanCaseIds: Set<any>;
  selectedPlanGroups: Array<{ group: RecordAny; cases: RecordAny[] }>;
  selectedPlanCasesByGroup: Array<{ group: RecordAny; cases: RecordAny[] }>;
  togglePlanGroup: (groupId: string) => void;
  togglePlanCase: (groupId: string, caseId: string) => void;
  users: RecordAny[];
  currentUser: RecordAny | null;
  selectedPlanId: string;
  selectPlanForAssignment: (planId: string) => void;
  assignDraft: { ownerId: string; assigneeIds: string[] };
  setAssignDraft: Dispatch<SetStateAction<{ ownerId: string; assigneeIds: string[] }>>;
  saveAssignments: (event: FormEvent) => Promise<void>;
  scopedPlans: RecordAny[];
  editingPlanId: string;
  editingExecutionMode: string;
  setEditingPlanId: Dispatch<SetStateAction<string>>;
  setEditingExecutionMode: Dispatch<SetStateAction<string>>;
  updatePlanExecutionMode: (planId: string, mode: string) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  duplicatePlan: (plan: RecordAny) => Promise<void>;
  runs: RecordAny[];
  openExecutionForPlan: (plan: RecordAny) => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  userName: (value: unknown) => string;
  getId: (value: unknown) => string;
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  isProjectScoped: boolean;
  scopedProjectName?: string;
};

export default function AdminTestPlansScreen(props: Props) {
  const {
    planForm,
    setPlanForm,
    createPlan,
    scopedProjects,
    scopedVersions,
    planProjectGroups,
    planProjectCases,
    selectedPlanGroupIds,
    selectedPlanCaseIds,
    selectedPlanGroups,
    selectedPlanCasesByGroup,
    togglePlanGroup,
    togglePlanCase,
    users,
    currentUser,
    selectedPlanId,
    selectPlanForAssignment,
    assignDraft,
    setAssignDraft,
    saveAssignments,
    scopedPlans,
    editingPlanId,
    setEditingPlanId,
    setEditingExecutionMode,
    updatePlanExecutionMode,
    deletePlan,
    duplicatePlan,
    runs,
    openExecutionForPlan,
    setActiveTab,
    userName,
    getId,
    matchesSearch,
    isProjectScoped,
    scopedProjectName,
  } = props;

  const selectAllCasesRef = useRef<HTMLInputElement | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const emptyPlanDraft = {
    name: "",
    description: "",
    projectId: isProjectScoped ? String(planForm.projectId || "") : "",
    versionId: "",
    executionMode: "manual",
    selectedGroupIds: [] as string[],
    caseIds: [] as string[],
  };
  const effectivePlanProjectId = String(planForm.projectId || "");

  const visibleCaseIds = useMemo(
    () =>
      selectedPlanGroups.flatMap(({ cases }) =>
        cases.map((testCase) => getId(testCase)),
      ),
    [getId, selectedPlanGroups],
  );
  const visibleCases = useMemo(
    () =>
      selectedPlanCasesByGroup.flatMap(({ group, cases }) =>
        cases.map((testCase) => ({ testCase, group })),
      ),
    [selectedPlanCasesByGroup],
  );

  const selectedPlanProject = useMemo(() => {
    if (!effectivePlanProjectId) {
      return planProjectGroups[0]?.project || null;
    }

    return (
      scopedProjects.find((project: RecordAny) => String(getId(project) || getId(project)) === effectivePlanProjectId) ||
      planProjectGroups[0]?.project ||
      null
    );
  }, [effectivePlanProjectId, getId, planProjectGroups, scopedProjects]);

  const selectedVisibleCaseCount = visibleCaseIds.filter((caseId) =>
    selectedPlanCaseIds.has(caseId),
  ).length;
  const allVisibleCasesSelected =
    visibleCaseIds.length > 0 && selectedVisibleCaseCount === visibleCaseIds.length;
  const someVisibleCasesSelected =
    selectedVisibleCaseCount > 0 && !allVisibleCasesSelected;

  useEffect(() => {
    if (selectAllCasesRef.current) {
      selectAllCasesRef.current.indeterminate = someVisibleCasesSelected;
    }
  }, [someVisibleCasesSelected]);

  function toggleAllVisibleCases() {
    const nextCaseIds = allVisibleCasesSelected
      ? planForm.caseIds.filter((caseId: string) => !visibleCaseIds.includes(caseId))
      : Array.from(new Set([...planForm.caseIds, ...visibleCaseIds]));

    setPlanForm((prev: any) => ({
      ...prev,
      caseIds: nextCaseIds,
      selectedGroupIds: prev.selectedGroupIds,
    }));
  }

  const selectedGroupCount = selectedPlanGroups.length;
  const filteredUsers = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((user: RecordAny) => {
      const name = String(user.name || "").toLowerCase();
      const role = String(user.role || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return name.includes(query) || role.includes(query) || email.includes(query);
    });
  }, [assigneeSearch, users]);

  const selectedAssignees = useMemo(
    () => users.filter((user: RecordAny) => assignDraft.assigneeIds.includes(getId(user))),
    [assignDraft.assigneeIds, getId, users],
  );

  const ownerName = currentUser?.name || "Current admin";
  const ownerRole = currentUser?.role || "admin";
  const [activePlanId, setActivePlanId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusBulkMode, setStatusBulkMode] = useState<"manual" | "automation">("manual");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    if (!showCreateModal || !editingPlanId || planProjectGroups.length === 0) {
      return;
    }

    if ((planForm.selectedGroupIds || []).length > 0) {
      return;
    }

    const defaultGroupIds = planProjectGroups.map((group: RecordAny) => getId(group));
    const timeoutId = window.setTimeout(() => {
      setPlanForm((prev: RecordAny) => {
        if ((prev.selectedGroupIds || []).length > 0) {
          return prev;
        }

        return {
          ...prev,
          selectedGroupIds: defaultGroupIds,
        };
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [editingPlanId, getId, planForm.selectedGroupIds, planProjectGroups, setPlanForm, showCreateModal]);

  const filteredPlans = useMemo(
    () =>
      scopedPlans.filter((plan: RecordAny) =>
        matchesSearch(plan.name, plan.project?.name, plan.version?.name, userName(plan.owner)),
      ),
    [matchesSearch, scopedPlans, userName],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    filteredPlans.length > 0 && filteredPlans.every((plan: RecordAny) => selectedSet.has(getId(plan)));

  const activePlan =
    scopedPlans.find((plan: RecordAny) => getId(plan) === String(activePlanId)) ||
    filteredPlans[0] ||
    null;

  const relatedRuns = useMemo(() => {
    if (!activePlan) return [];
    return runs
      .filter((run: RecordAny) => getId(run.testPlan) === getId(activePlan))
      .sort(
        (a: RecordAny, b: RecordAny) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, 6);
  }, [activePlan, getId, runs]);

  const progressStats = useMemo(() => {
    const totalPlans = scopedPlans.length;
    const automationPlans = scopedPlans.filter((plan: RecordAny) => String(plan.executionMode) === "automation").length;
    const runningRuns = runs.filter((run: RecordAny) => run.status === "running").length;
    const completedRuns = runs.filter((run: RecordAny) => run.status === "completed").length;
    return { totalPlans, automationPlans, runningRuns, completedRuns };
  }, [runs, scopedPlans]);

  const recentActivity = useMemo(() => {
    return [...scopedPlans]
      .sort(
        (a: RecordAny, b: RecordAny) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 5);
  }, [scopedPlans]);

  const selectedPlans = filteredPlans.filter((plan: RecordAny) => selectedSet.has(getId(plan)));

  function togglePlanSelection(planId: string) {
    setSelectedIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId],
    );
  }

  async function bulkUpdateExecutionMode() {
    for (const plan of selectedPlans) {
      await updatePlanExecutionMode(getId(plan), statusBulkMode);
    }
    setSelectedIds([]);
  }

  function openCreatePlanModal() {
    setEditingPlanId("");
    setEditingExecutionMode("");
    setPlanForm(emptyPlanDraft);
    setShowCreateModal(true);
  }

  function openEditPlanModal(plan: RecordAny) {
    const caseIds = Array.isArray(plan.items)
      ? plan.items.map((item: RecordAny) => String(getId(item.testCase) || item.testCase)).filter(Boolean)
      : [];

    setEditingPlanId(getId(plan));
    setEditingExecutionMode(String(plan.executionMode || "manual"));
    setPlanForm({
      name: plan.name || "",
      description: plan.description || "",
      projectId: String(getId(plan.project) || ""),
      versionId: String(getId(plan.version) || ""),
      executionMode: String(plan.executionMode || "manual"),
      selectedGroupIds: [],
      caseIds,
    });
    setShowCreateModal(true);
  }

  function closePlanModal() {
    setShowCreateModal(false);
    setEditingPlanId("");
    setEditingExecutionMode("");
    setPlanForm(emptyPlanDraft);
  }

  function openAssignModal(planId?: string) {
    if (planId) {
      selectPlanForAssignment(planId);
    }

    setShowAssignModal(true);
  }

  async function handleSaveAssignments(event: FormEvent) {
    await saveAssignments(event);
    setShowAssignModal(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-sky-50 to-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Test Plan Workbench</div>
            <div className="text-xs text-slate-600">Planning hub: assign case, track progress, jump to execution</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Plans</div><div className="text-lg font-semibold text-slate-900">{progressStats.totalPlans}</div></div>
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Automation</div><div className="text-lg font-semibold text-violet-700">{progressStats.automationPlans}</div></div>
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Running runs</div><div className="text-lg font-semibold text-amber-700">{progressStats.runningRuns}</div></div>
          <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2"><div className="text-[11px] uppercase tracking-wide text-slate-500">Completed runs</div><div className="text-lg font-semibold text-emerald-700">{progressStats.completedRuns}</div></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Toolbar</span>
          <ActionButton
            label="Create"
            icon="＋"
            variant="primary"
            onClick={openCreatePlanModal}
            tooltip="Open create test plan modal"
          />
          <ActionButton
            label="Assign"
            icon="👥"
            onClick={() => {
              if (getId(activePlan)) {
                openAssignModal(getId(activePlan));
              }
            }}
            disabled={!activePlan}
            tooltip={activePlan ? "Assign members to selected plan" : "Select a plan first"}
          />
          <ActionButton
            label="Run"
            icon="▶"
            onClick={() => activePlan && openExecutionForPlan(activePlan)}
            disabled={!activePlan}
            tooltip={activePlan ? "Start a run from selected plan" : "Select a plan first"}
          />
          <ActionButton
            label="Duplicate"
            icon="⧉"
            onClick={() => activePlan && void duplicatePlan(activePlan)}
            disabled={!activePlan}
            tooltip={activePlan ? "Duplicate selected plan" : "Select a plan first"}
          />
          <ActionButton
            label="Refresh"
            icon="↻"
            onClick={() => {
              setSelectedIds([]);
              setActivePlanId("");
            }}
            tooltip="Reset local view, filters, and selection"
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredPlans.length} visible</span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{selectedIds.length} selected</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">Plan grid</div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select value={statusBulkMode} onChange={(e) => setStatusBulkMode(e.target.value as "manual" | "automation")} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                <option value="manual">manual</option><option value="automation">automation</option>
              </select>
              <button type="button" title="Bulk update status" onClick={() => void bulkUpdateExecutionMode()} disabled={selectedIds.length === 0} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50">Bulk mode</button>
            </div>
          </div>
          <div className="max-h-[620px] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : filteredPlans.map((item: RecordAny) => getId(item)))} /></th>
                  <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPlans.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No plans</td></tr> : filteredPlans.map((plan: RecordAny) => {
                  const planId = getId(plan);
                  const selected = selectedSet.has(planId);
                  const active = getId(activePlan) === planId;
                  const hasRuns = runs.some((run: RecordAny) => getId(run.testPlan) === planId);
                  return <tr key={planId} onClick={() => setActivePlanId(planId)} className={`cursor-pointer transition hover:bg-slate-50 ${active ? "bg-indigo-50/60" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); togglePlanSelection(planId); }} /></td>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{plan.name}</div><div className="text-xs text-slate-500">{(plan.items || []).length} case(s)</div></td>
                    <td className="px-4 py-3 text-xs text-slate-600"><div>{plan.project?.name || "-"}</div><div>{plan.version?.name || "-"}</div></td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{userName(plan.owner)}</td>
                    <td className="px-4 py-3"><span className={String(plan.executionMode || "manual") === "automation" ? "rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"}>{plan.executionMode || "manual"}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                      <button title="Edit" type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); openEditPlanModal(plan); }}>✎</button>
                      <button title="Duplicate" type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void duplicatePlan(plan); }}>⧉</button>
                      <button title={hasRuns ? "Plan da co run, khong the xoa" : "Delete"} type="button" disabled={hasRuns} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={(e) => { e.stopPropagation(); void deletePlan(planId); }}>🗑</button>
                      <button title="Run" type="button" className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700" onClick={(e) => { e.stopPropagation(); openExecutionForPlan(plan); }}>▶</button>
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Plan detail</div>
              {!activePlan ? <div className="mt-3 text-sm text-slate-500">Select a plan to inspect details</div> : <div className="mt-3 space-y-3 text-sm">
                <div><div className="text-xs uppercase tracking-wide text-slate-500">Name</div><div className="font-semibold text-slate-900">{activePlan.name}</div></div>
              <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Project</div><div className="font-semibold text-slate-800">{activePlan.project?.name || "-"}</div></div><div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Version</div><div className="font-semibold text-slate-800">{activePlan.version?.name || "-"}</div></div></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{activePlan.description || "No description"}</div>
              <div className="flex gap-2"><button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openExecutionForPlan(activePlan)}>Run this plan</button><button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" onClick={() => openAssignModal(getId(activePlan))}>Assign cases</button></div>
            </div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Recent activity</div>
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold" onClick={() => {}}>View all</button>
            </div>
            <div className="mt-3 space-y-2">
              {recentActivity.map((item: RecordAny) => <button key={getId(item)} type="button" onClick={() => setActivePlanId(getId(item))} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-slate-300"><span><span className="block text-xs text-slate-500">{item.project?.name || "-"}</span><span className="block text-sm font-semibold text-slate-900">{item.name}</span></span><span className="text-xs text-slate-400">{new Date(item.updatedAt || item.createdAt || 0).toLocaleDateString()}</span></button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Execution runs</div>
              <button type="button" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold" onClick={() => setActiveTab("test-runs-execution")}>View all</button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {relatedRuns.length === 0 ? <div className="text-slate-500">No related runs</div> : relatedRuns.map((run: RecordAny) => <div key={String(getId(run))} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><strong className="text-slate-900">{run.name || "Run"}</strong><span className={run.status === "completed" ? "text-emerald-700" : run.status === "running" ? "text-amber-700" : "text-slate-500"}>{run.status || "pending"}</span></div><div className="text-xs text-slate-500">{new Date(run.createdAt || 0).toLocaleString()}</div></div>)}
            </div>
          </section>
        </aside>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closePlanModal}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">{editingPlanId ? "Edit Test Plan" : "Create Test Plan"}</h3>
            <p className="mb-4 text-sm text-slate-600">{editingPlanId ? "Sua thong tin plan, gom ca danh sach test case." : "Assign user va tao plan rieng biet"}</p>
            <form className="space-y-4" onSubmit={async (e) => {
              const saved = await createPlan(e);
              if (saved) setShowCreateModal(false);
            }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project">
                  {isProjectScoped ? (
                    <input
                      className={`${INPUT_CLS} bg-slate-50`}
                      value={scopedProjectName || "Selected project"}
                      readOnly
                    />
                  ) : (
                    <select
                      className={INPUT_CLS}
                      value={planForm.projectId}
                      onChange={(e) => setPlanForm((prev: any) => ({ ...prev, projectId: e.target.value, versionId: "", selectedGroupIds: [], caseIds: [] }))}
                      required
                    >
                      <option value="">Select project</option>
                      {scopedProjects.map((project: RecordAny) => (
                        <option key={getId(project)} value={getId(project)}>{project.name}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Version">
                  <select
                    className={INPUT_CLS}
                    value={planForm.versionId}
                    onChange={(e) => setPlanForm((prev: any) => ({ ...prev, versionId: e.target.value }))}
                    required
                  >
                    <option value="">Select version</option>
                    {scopedVersions
                      .filter((version: RecordAny) => getId(version.project) === effectivePlanProjectId)
                      .map((version: RecordAny) => (
                        <option key={getId(version)} value={getId(version)}>{version.name}</option>
                      ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Execution Mode">
                  <select
                    className={INPUT_CLS}
                    value={planForm.executionMode || "manual"}
                    onChange={(e) => setPlanForm((prev: any) => ({ ...prev, executionMode: e.target.value }))}
                  >
                    <option value="manual">Manual</option>
                    <option value="automation">Automation</option>
                  </select>
                </Field>
                <Field label="Name">
                  <input
                    className={INPUT_CLS}
                    value={planForm.name}
                    onChange={(e) => setPlanForm((prev: any) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={3}
                  className={INPUT_CLS}
                  value={planForm.description}
                  onChange={(e) => setPlanForm((prev: any) => ({ ...prev, description: e.target.value }))}
                />
              </Field>

              {/* ── Group Checklist ── */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Groups</span>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  {!selectedPlanProject ? (
                    <div className="py-4 text-center text-xs text-slate-400">Chọn project trước để lấy danh sách group.</div>
                  ) : (
                    <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm" open>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 transition group-open:rounded-b-none group-open:border-b group-open:border-slate-200">
                        <span className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                            {String(selectedPlanProject.name || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <strong className="block text-slate-900">{selectedPlanProject.name}</strong>
                            <span className="block text-xs font-normal text-slate-500">{planProjectGroups.length} groups in scope</span>
                          </span>
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{selectedPlanGroupIds.size} selected</span>
                      </summary>

                      <div className="space-y-2 border-l border-slate-200 px-4 py-3">
                        {planProjectGroups.length === 0 ? (
                          <div className="py-3 text-center text-xs text-slate-400">Không có group nào trong project này.</div>
                        ) : (
                          planProjectGroups.map((group: RecordAny) => {
                            const groupId = getId(group);
                            const checked = selectedPlanGroupIds.has(groupId);
                            const groupCases = planProjectCases.filter((testCase: RecordAny) => String(getId(testCase.group)) === groupId);
                            const shouldScrollCases = groupCases.length >= 4;

                            return (
                              <details key={groupId} className={`rounded-xl border px-3 py-2.5 ${checked ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-slate-50"}`}>
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                                  <label className="flex flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0" onClick={(event) => event.stopPropagation()}>
                                    <input type="checkbox" className="h-4 w-4 rounded accent-emerald-600" checked={checked} onChange={() => togglePlanGroup(groupId)} />
                                    <span className="flex flex-col gap-0.5">
                                      <strong className="text-sm font-semibold text-slate-900">{group.name}</strong>
                                      <small className="text-xs text-slate-500">{groupCases.length} test cases</small>
                                    </span>
                                  </label>
                                </summary>

                                <div className="mt-3 border-l border-slate-200 pl-3">
                                  {groupCases.length === 0 ? (
                                    <div className="py-3 text-center text-xs text-slate-400">Không có test case trong group này.</div>
                                  ) : (
                                    <div className={`space-y-1 ${shouldScrollCases ? "max-h-[240px] overflow-y-auto pr-1" : ""}`}>
                                      {groupCases.map((testCase: RecordAny) => {
                                        const caseId = getId(testCase);
                                        const checkedCase = selectedPlanCaseIds.has(caseId);
                                        return (
                                          <label key={caseId} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${checkedCase ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}>
                                            <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={checkedCase} onChange={() => togglePlanCase(groupId, caseId)} />
                                            <span className="flex min-w-0 flex-col gap-0.5">
                                              <strong className="block truncate text-xs font-semibold text-slate-900">{testCase.caseKey} - {testCase.title}</strong>
                                              <small className="block truncate text-[11px] text-slate-400">{testCase.description || "No description"}</small>
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </details>
                            );
                          })
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* ── Cases Panel ── */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Test cases</span>
                    <p className="mt-0.5 text-xs text-slate-500">Chọn nhiều test case từ các group khác nhau.</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-600">
                      <input
                        ref={selectAllCasesRef}
                        type="checkbox"
                        className="h-4 w-4 rounded accent-blue-600"
                        checked={allVisibleCasesSelected}
                        onChange={toggleAllVisibleCases}
                        disabled={visibleCaseIds.length === 0}
                      />
                      All
                    </label>
                    <span className="font-semibold text-slate-700">{selectedPlanCaseIds.size} selected</span>
                    <span className="text-slate-500">{selectedGroupCount} group(s)</span>
                  </div>
                </div>

                {selectedPlanGroups.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">Chọn ít nhất 1 group để hiện test case.</div>
                ) : (
                  <div className="mt-3 max-h-[300px] space-y-1 overflow-y-auto">
                    {visibleCases.length === 0 ? (
                      <div className="py-3 text-center text-xs text-slate-400">Các group đã chọn chưa có test case.</div>
                    ) : (
                      visibleCases.map(({ testCase, group }) => {
                        const caseId = getId(testCase);
                        const checked = selectedPlanCaseIds.has(caseId);
                        return (
                          <label key={caseId} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${checked ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}>
                            <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={checked} onChange={() => togglePlanCase(getId(group), caseId)} />
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <strong className="block truncate text-xs font-semibold text-slate-900">{testCase.caseKey} - {testCase.title}</strong>
                              <small className="block truncate text-[11px] text-slate-400">{testCase.description || "No description"}</small>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <Button type="submit" variant="primary">
                {editingPlanId ? "💾 Save test plan" : "＋ Create test plan"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAssignModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Assign Assignees</h3>
            <p className="mb-4 text-sm text-slate-600">Owner se tu dong la admin dang thao tac</p>

            <form className="space-y-4" onSubmit={async (event) => { await handleSaveAssignments(event); }}>
              <Field label="Test Plan">
                <select className={INPUT_CLS} value={selectedPlanId} onChange={(e) => selectPlanForAssignment(e.target.value)} required>
                  <option value="">Select plan</option>
                  {scopedPlans.map((plan: RecordAny) => (
                    <option key={getId(plan)} value={getId(plan)}>{plan.name}</option>
                  ))}
                </select>
              </Field>

              <div>
                <Field label="Assign Members">
                  <input
                    type="search"
                    className={INPUT_CLS}
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder="Search users..."
                  />
                </Field>
                <div className="mt-2 max-h-[280px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2" role="group" aria-label="Assignees">
                  {filteredUsers.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">No users found.</div>
                  ) : (
                    filteredUsers.map((user: RecordAny) => {
                      const userId = getId(user);
                      const checked = assignDraft.assigneeIds.includes(userId);
                      return (
                        <label key={userId} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${checked ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-white"}`}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-blue-600"
                            checked={checked}
                            onChange={() => {
                              setAssignDraft((prev: any) => ({
                                ...prev,
                                assigneeIds: checked
                                  ? prev.assigneeIds.filter((id: string) => id !== userId)
                                  : [...prev.assigneeIds, userId],
                              }));
                            }}
                          />
                          <span className="flex flex-col gap-0.5">
                            <strong className="text-sm font-semibold text-slate-900">{user.name}</strong>
                            <small className="text-xs text-slate-500">{user.role}</small>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-medium text-slate-500">Owner (tự động)</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {ownerName} <span className="text-xs font-normal text-slate-500">({ownerRole})</span>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <strong>{selectedAssignees.length}</strong> members selected
              </div>

              <Button type="submit" variant="primary">💾 Save assignment</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
