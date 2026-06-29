"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import { ActionButton, Button, ClientPaginationBar, Field, INPUT_CLS, ScopedProjectField, StatusBadge, useClientPagination } from "./shared";
import { apiRequest, countPlanAutomationCases, findEntityByReference, isEntityReferenceSelected, matchesEntityId, matchesSelectedEntity, normalizeEntityReferences, summarizeRunResults } from "@/lib/api";
import type { TestPlanDetail } from "@/lib/tcmTypes";

type RecordAny = Record<string, any>;

type PlanRunSnapshot = {
  lastRunAt: string | null;
  latestRun: RecordAny | null;
};

function formatPlanLastRun(dateValue: string | null | undefined) {
  if (!dateValue) return "Never";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function LatestRunResultBadge({ run }: { run: RecordAny | null | undefined }) {
  if (!run) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  if (run.status === "running") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Running
      </span>
    );
  }

  const results = Array.isArray(run.results) ? run.results : [];
  const summary = results.length > 0 ? summarizeRunResults(results) : null;
  const passRate = summary?.passRate ?? Number(run.passRate ?? 0);
  const failCount = summary?.fail ?? 0;

  if (failCount > 0) {
    return (
      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        {failCount} fail
      </span>
    );
  }

  if (passRate > 0) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          passRate >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
        }`}
      >
        {passRate}% pass
      </span>
    );
  }

  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      Pending
    </span>
  );
}

function planLatestHasFailing(run: RecordAny | null | undefined) {
  if (!run) return false;
  const results = Array.isArray(run.results) ? run.results : [];
  if (results.length === 0) return false;
  return summarizeRunResults(results).fail > 0;
}

type Props = {
  planForm: any;
  setPlanForm: Dispatch<SetStateAction<any>>;
  createPlan: (event: FormEvent) => Promise<{ plan: RecordAny; created: boolean } | null>;
  listFilters: {
    versionId: string;
    status: "all" | "has_runs" | "no_runs" | "has_failing";
  };
  scopedProjects: RecordAny[];
  scopedVersions: RecordAny[];
  planProjectGroups: RecordAny[];
  planProjectCases: RecordAny[];
  allGroups: RecordAny[];
  allTestCases: RecordAny[];
  selectedPlanGroupIds: Set<any>;
  selectedPlanCaseIds: Set<any>;
  selectedPlanGroups: Array<{ group: RecordAny; cases: RecordAny[] }>;
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
  setEditingPlanId: Dispatch<SetStateAction<string>>;
  deletePlan: (planId: string) => Promise<void>;
  duplicatePlan: (plan: RecordAny) => Promise<void>;
  runs: RecordAny[];
  openExecutionForPlan: (plan: RecordAny) => void;
  openRunForPlan: (runId: string, plan: RecordAny) => void;
  openAllRunsForPlan: (plan: RecordAny) => void;
  openPlanInsights: (plan: RecordAny) => void;
  onReload: () => Promise<void>;
  reloading?: boolean;
  reloadToken?: number;
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
    listFilters,
    scopedProjects,
    scopedVersions,
    planProjectGroups,
    planProjectCases,
    allGroups,
    allTestCases,
    selectedPlanGroupIds,
    selectedPlanCaseIds,
    selectedPlanGroups,
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
    deletePlan,
    duplicatePlan,
    runs,
    openExecutionForPlan,
    openRunForPlan,
    openAllRunsForPlan,
    openPlanInsights,
    onReload,
    reloading = false,
    reloadToken = 0,
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
    projectId: isProjectScoped ? String(planForm.projectId || getId(scopedProjects[0]) || "") : "",
    versionId: "",
    selectedGroupIds: [] as string[],
    caseIds: [] as string[],
  };
  const effectivePlanProjectId = String(planForm.projectId || "");

  const visibleCases = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ testCase: RecordAny; group: RecordAny }> = [];

    const pushCase = (testCase: RecordAny, group: RecordAny) => {
      const caseId = getId(testCase);
      if (!caseId || seen.has(caseId)) {
        return;
      }
      seen.add(caseId);
      items.push({ testCase, group });
    };

    for (const { group, cases } of selectedPlanGroups) {
      for (const testCase of cases) {
        pushCase(testCase, group);
      }
    }

    for (const caseId of Array.isArray(planForm.caseIds) ? planForm.caseIds : []) {
      const testCase = findEntityByReference(allTestCases, caseId);
      if (!testCase) {
        continue;
      }

      const group =
        findEntityByReference(allGroups, testCase.group) ||
        (typeof testCase.group === "object" && testCase.group
          ? testCase.group
          : { name: "Unknown group", _id: getId(testCase.group) });

      pushCase(testCase, group as RecordAny);
    }

    return items;
  }, [allGroups, allTestCases, getId, planForm.caseIds, selectedPlanGroups]);
  const visibleCaseIds = useMemo(
    () => visibleCases.map(({ testCase }) => getId(testCase)).filter(Boolean),
    [getId, visibleCases],
  );
  const planCasePickerResetKey = `${selectedPlanGroupIds.size}|${visibleCases.length}`;
  const planCasePickerPagination = useClientPagination(visibleCases, 12, planCasePickerResetKey);
  const paginatedVisibleCases = planCasePickerPagination.visibleItems;

  const selectedPlanProject = useMemo(() => {
    if (!effectivePlanProjectId) {
      return planProjectGroups[0]?.project || null;
    }

    return (
      scopedProjects.find((project: RecordAny) => matchesSelectedEntity(project, effectivePlanProjectId)) ||
      planProjectGroups[0]?.project ||
      null
    );
  }, [effectivePlanProjectId, planProjectGroups, scopedProjects]);

  const versionOptions = useMemo(() => {
    if (!effectivePlanProjectId) {
      return isProjectScoped ? scopedVersions : [];
    }

    return scopedVersions.filter((version: RecordAny) =>
      matchesSelectedEntity(version.project, effectivePlanProjectId),
    );
  }, [effectivePlanProjectId, isProjectScoped, scopedVersions]);

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [startRunPromptPlan, setStartRunPromptPlan] = useState<RecordAny | null>(null);
  const [focusedPlanInsights, setFocusedPlanInsights] = useState<TestPlanDetail | null>(null);
  const [focusedInsightsLoading, setFocusedInsightsLoading] = useState(false);
  const [casesPanelOpen, setCasesPanelOpen] = useState(true);

  useEffect(() => {
    if (!activePlanId) {
      setFocusedPlanInsights(null);
      setFocusedInsightsLoading(false);
      return;
    }

    let cancelled = false;

    const loadInsights = async () => {
      setFocusedInsightsLoading(true);
      try {
        const detail = await apiRequest<TestPlanDetail>(
          `/api/dashboard/test-plans/${encodeURIComponent(activePlanId)}`,
        );
        if (!cancelled) {
          setFocusedPlanInsights(detail);
        }
      } catch {
        if (!cancelled) {
          setFocusedPlanInsights(null);
        }
      } finally {
        if (!cancelled) {
          setFocusedInsightsLoading(false);
        }
      }
    };

    void loadInsights();
    return () => {
      cancelled = true;
    };
  }, [activePlanId, reloadToken]);

  const planRunSnapshots = useMemo(() => {
    const snapshots = new Map<string, PlanRunSnapshot>();
    for (const run of runs) {
      const planId = String(getId(run.testPlan) || "");
      if (!planId) continue;

      const runTime = new Date(run.createdAt || 0).getTime();
      const existing = snapshots.get(planId);
      const existingTime = existing?.lastRunAt ? new Date(existing.lastRunAt).getTime() : 0;

      if (!existing || runTime > existingTime) {
        snapshots.set(planId, {
          lastRunAt: run.createdAt ? String(run.createdAt) : null,
          latestRun: run,
        });
      }
    }
    return snapshots;
  }, [getId, runs]);

  const filteredPlans = useMemo(() => {
    return scopedPlans.filter((plan: RecordAny) => {
      if (!matchesSearch(plan.name, plan.project?.name, plan.version?.name, userName(plan.owner))) {
        return false;
      }

      if (listFilters.versionId && !matchesSelectedEntity(plan.version, listFilters.versionId)) {
        return false;
      }

      const planId = getId(plan);
      const runCount = runs.filter((run) => String(getId(run.testPlan) || "") === planId).length;
      const latestRun = planRunSnapshots.get(planId)?.latestRun;

      if (listFilters.status === "has_runs" && runCount === 0) {
        return false;
      }
      if (listFilters.status === "no_runs" && runCount > 0) {
        return false;
      }
      if (listFilters.status === "has_failing" && !planLatestHasFailing(latestRun)) {
        return false;
      }

      return true;
    });
  }, [getId, listFilters, matchesSearch, planRunSnapshots, runs, scopedPlans, userName]);

  const planListResetKey = `${listFilters.versionId}|${listFilters.status}|${filteredPlans.length}`;
  const planListPagination = useClientPagination(filteredPlans, 15, planListResetKey);
  const paginatedPlans = planListPagination.visibleItems;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    filteredPlans.length > 0 && filteredPlans.every((plan: RecordAny) => selectedSet.has(getId(plan)));

  const activePlan = activePlanId
    ? scopedPlans.find((plan: RecordAny) => getId(plan) === String(activePlanId)) || null
    : null;

  const runCountByPlanId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of runs) {
      const planId = String(getId(run.testPlan) || "");
      if (!planId) continue;
      counts.set(planId, (counts.get(planId) || 0) + 1);
    }
    return counts;
  }, [getId, runs]);

  /** Toolbar actions target focused plan, or the only bulk-selected plan. */
  const toolbarPlan =
    activePlan ||
    (selectedIds.length === 1
      ? scopedPlans.find((plan: RecordAny) => getId(plan) === selectedIds[0]) || null
      : null);

  const runsScopePlanIds = useMemo(() => {
    if (activePlanId) return [activePlanId];
    if (selectedIds.length > 0) return selectedIds;
    return [];
  }, [activePlanId, selectedIds]);

  const runsScopePlans = useMemo(
    () =>
      runsScopePlanIds
        .map((planId) => scopedPlans.find((plan: RecordAny) => getId(plan) === planId))
        .filter(Boolean) as RecordAny[],
    [getId, runsScopePlanIds, scopedPlans],
  );

  const isMultiPlanRunsScope = !activePlanId && selectedIds.length > 1;

  function selectActivePlan(planId: string) {
    setActivePlanId((prev) => (prev === planId ? "" : planId));
  }

  function clearPlanSelection() {
    setActivePlanId("");
    setSelectedIds([]);
  }

  const relatedRuns = useMemo(() => {
    if (!runsScopePlanIds.length) return [];
    const scopeSet = new Set(runsScopePlanIds);
    return runs
      .filter((run: RecordAny) => scopeSet.has(String(getId(run.testPlan) || "")))
      .sort(
        (a: RecordAny, b: RecordAny) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, isMultiPlanRunsScope ? 8 : 6);
  }, [getId, isMultiPlanRunsScope, runs, runsScopePlanIds]);

  const focusedPlanCaseRows = useMemo(() => {
    if (focusedPlanInsights?.testCases?.length) {
      return focusedPlanInsights.testCases.map((item) => ({
        id: item.testCaseId,
        caseKey: item.caseKey,
        title: item.title,
        latestStatus: String(item.latestStatus || "untested"),
      }));
    }

    if (!activePlan) return [];

    return (Array.isArray(activePlan.items) ? activePlan.items : []).map((item: RecordAny) => {
      const caseId = String(getId(item.testCase) || item.testCase || "");
      const testCase = planProjectCases.find((entry) => getId(entry) === caseId);
      return {
        id: caseId,
        caseKey: testCase?.caseKey || item.testCase?.caseKey || caseId,
        title: testCase?.title || item.testCase?.title || "—",
        latestStatus: "untested",
      };
    });
  }, [activePlan, focusedPlanInsights, getId, planProjectCases]);

  const focusedCaseRowsPagination = useClientPagination(
    focusedPlanCaseRows,
    8,
    `${activePlanId}|${focusedPlanCaseRows.length}`,
  );
  const paginatedFocusedPlanCaseRows = focusedCaseRowsPagination.visibleItems;

  const focusedSummary = focusedPlanInsights?.summary;
  const focusedRunSnapshot = activePlan ? planRunSnapshots.get(getId(activePlan)) : null;

  function planForRun(run: RecordAny) {
    const planId = String(getId(run.testPlan) || "");
    return scopedPlans.find((plan: RecordAny) => getId(plan) === planId) || null;
  }

  const progressStats = useMemo(() => {
    const totalPlans = scopedPlans.length;
    const automationPlans = scopedPlans.filter((plan: RecordAny) => countPlanAutomationCases(plan) > 0).length;
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

  function togglePlanSelection(planId: string) {
    setSelectedIds((prev) => {
      const isRemoving = prev.includes(planId);
      const next = isRemoving ? prev.filter((id) => id !== planId) : [...prev, planId];

      setActivePlanId((currentFocus) => {
        if (!isRemoving) {
          return planId;
        }
        if (currentFocus !== planId) {
          return currentFocus;
        }
        if (next.length === 0) {
          return "";
        }
        return next[next.length - 1];
      });

      return next;
    });
  }

  function openCreatePlanModal() {
    setEditingPlanId("");
    setPlanForm(emptyPlanDraft);
    setShowCreateModal(true);
  }

  function openEditPlanModal(plan: RecordAny) {
    const planProjectId = String(getId(plan.project) || "");
    const editGroups = planProjectId
      ? allGroups.filter((group) => matchesSelectedEntity(group.project, planProjectId))
      : allGroups;
    const editCases = planProjectId
      ? allTestCases.filter((testCase) => matchesSelectedEntity(testCase.project, planProjectId))
      : allTestCases;

    const rawCaseRefs = Array.isArray(plan.items)
      ? plan.items.map((item: RecordAny) => item.testCase).filter(Boolean)
      : [];
    const caseIds = normalizeEntityReferences(
      rawCaseRefs.map((ref) => String(getId(ref) || ref || "").trim()).filter(Boolean),
      editCases,
    );

    const selectedGroupIdSet = new Set<string>();
    for (const caseId of caseIds) {
      const testCase = findEntityByReference(editCases, caseId);
      if (!testCase?.group) {
        continue;
      }

      for (const group of editGroups) {
        if (matchesEntityId(testCase.group, group)) {
          selectedGroupIdSet.add(getId(group));
        }
      }
    }

    setEditingPlanId(getId(plan));
    setPlanForm({
      name: plan.name || "",
      description: plan.description || "",
      projectId: planProjectId,
      versionId: String(getId(plan.version) || ""),
      selectedGroupIds: Array.from(selectedGroupIdSet),
      caseIds,
    });
    setShowCreateModal(true);
  }

  function closePlanModal() {
    setShowCreateModal(false);
    setEditingPlanId("");
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
            label="Insights"
            icon="📊"
            onClick={() => toolbarPlan && openPlanInsights(toolbarPlan)}
            disabled={!toolbarPlan}
            tooltip={toolbarPlan ? "View plan quality insights" : "Focus one plan (click row) first"}
          />
          <ActionButton
            label="Run"
            icon="▶"
            onClick={() => toolbarPlan && openExecutionForPlan(toolbarPlan)}
            disabled={!toolbarPlan}
            tooltip={toolbarPlan ? "Start a run from focused plan" : "Focus one plan (click row) first"}
          />
          <ActionButton
            label="Duplicate"
            icon="⧉"
            onClick={() => toolbarPlan && void duplicatePlan(toolbarPlan)}
            disabled={!toolbarPlan}
            tooltip={toolbarPlan ? "Duplicate focused plan" : "Focus one plan (click row) first"}
          />
          <ActionButton
            label={reloading ? "Reloading…" : "Reload"}
            icon="↻"
            onClick={() => void onReload()}
            disabled={reloading}
            tooltip="Reload plans and runs from server"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredPlans.length} visible</span>
            {activePlanId ? (
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800">1 focused</span>
            ) : null}
            {selectedIds.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{selectedIds.length} bulk</span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Plan grid</div>
              <div className="text-[11px] text-slate-500">Click row to focus</div>
            </div>
          </div>
          <div className="max-h-[620px] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : filteredPlans.map((item: RecordAny) => getId(item)))} /></th>
                  <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Runs</th><th className="px-4 py-3">Last run</th><th className="px-4 py-3">Latest</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Auto cases</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPlans.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No plans</td></tr> : paginatedPlans.map((plan: RecordAny) => {
                  const planId = getId(plan);
                  const bulkSelected = selectedSet.has(planId);
                  const focused = activePlanId === planId;
                  const runCount = runCountByPlanId.get(planId) || 0;
                  const runSnapshot = planRunSnapshots.get(planId);
                  const hasRuns = runCount > 0;
                  return <tr key={planId} onClick={() => selectActivePlan(planId)} className={`cursor-pointer transition hover:bg-slate-50 ${focused ? "bg-indigo-50/60 ring-1 ring-inset ring-indigo-200" : bulkSelected ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={bulkSelected} onChange={(e) => { e.stopPropagation(); togglePlanSelection(planId); }} /></td>
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{plan.name}</div><div className="text-xs text-slate-500">{(plan.items || []).length} case(s)</div></td>
                    <td className="px-4 py-3 text-xs text-slate-600"><div>{plan.project?.name || "-"}</div><div>{plan.version?.name || "-"}</div></td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-slate-700">{runCount > 0 ? `${runCount} run(s)` : <span className="font-normal text-slate-400">Never</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatPlanLastRun(runSnapshot?.lastRunAt)}</td>
                    <td className="px-4 py-3"><LatestRunResultBadge run={runSnapshot?.latestRun} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{userName(plan.owner)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{countPlanAutomationCases(plan)} / {(plan.items || []).length}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                      <button title="Insights" type="button" className="rounded-lg border border-indigo-200 px-2 py-1 text-xs text-indigo-700" onClick={(e) => { e.stopPropagation(); openPlanInsights(plan); }}>📊</button>
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
          {planListPagination.hasPagination ? (
            <ClientPaginationBar
              currentPage={planListPagination.currentPage}
              totalPages={planListPagination.totalPages}
              totalItems={planListPagination.totalItems}
              onPageChange={planListPagination.setCurrentPage}
            />
          ) : null}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">Plan detail</div>
              {activePlanId || selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  onClick={clearPlanSelection}
                >
                  Clear all
                </button>
              ) : null}
            </div>
              {!activePlan && selectedIds.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Click a row to focus a plan and view its runs</div>
              ) : !activePlan && selectedIds.length > 1 ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <strong>{selectedIds.length} plans</strong> selected for bulk actions. Click a row to focus one plan for details.
                  </div>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {runsScopePlans.map((plan) => (
                      <li key={getId(plan)} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="font-semibold text-slate-800">{plan.name}</span>
                        <span className="tabular-nums text-slate-500">{runCountByPlanId.get(getId(plan)) || 0} run(s)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : activePlan ? (
                <div className="mt-3 space-y-3 text-sm">
                <div><div className="text-xs uppercase tracking-wide text-slate-500">Name</div><div className="font-semibold text-slate-900">{activePlan.name}</div></div>
              <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Project</div><div className="font-semibold text-slate-800">{activePlan.project?.name || "-"}</div></div><div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">Version</div><div className="font-semibold text-slate-800">{activePlan.version?.name || "-"}</div></div></div>
              {focusedInsightsLoading ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading latest stats…</div>
              ) : focusedSummary && focusedSummary.totalTests > 0 ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-slate-500">Cases</div>
                    <div className="font-semibold text-slate-900">{focusedSummary.totalTests}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <div className="text-emerald-700">Pass rate</div>
                    <div className="font-semibold text-emerald-800">{focusedSummary.passRate}%</div>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                    <div className="text-rose-700">Failing</div>
                    <div className="font-semibold text-rose-800">{focusedSummary.failCount}</div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-slate-500">Runs</div>
                    <div className="font-semibold text-slate-800">{runCountByPlanId.get(getId(activePlan)) || 0} total</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-slate-500">Latest</div>
                    <div className="mt-0.5"><LatestRunResultBadge run={focusedRunSnapshot?.latestRun} /></div>
                  </div>
                </div>
              )}
              {focusedRunSnapshot?.lastRunAt ? (
                <div className="text-xs text-slate-500">
                  Last run: {formatPlanLastRun(focusedRunSnapshot.lastRunAt)}
                </div>
              ) : null}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{activePlan.description || "No description"}</div>
              <details
                className="rounded-lg border border-slate-200 bg-white"
                open={casesPanelOpen}
                onToggle={(event) => setCasesPanelOpen((event.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
                  Cases in plan ({focusedPlanCaseRows.length})
                </summary>
                <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-100 px-3 py-2">
                  {focusedPlanCaseRows.length === 0 ? (
                    <div className="py-2 text-xs text-slate-400">No cases in this plan</div>
                  ) : (
                    paginatedFocusedPlanCaseRows.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 text-xs hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-800">{item.caseKey}</div>
                          <div className="truncate text-slate-500">{item.title}</div>
                        </div>
                        <StatusBadge status={item.latestStatus} />
                      </div>
                    ))
                  )}
                </div>
                {focusedCaseRowsPagination.hasPagination ? (
                  <ClientPaginationBar
                    currentPage={focusedCaseRowsPagination.currentPage}
                    totalPages={focusedCaseRowsPagination.totalPages}
                    totalItems={focusedCaseRowsPagination.totalItems}
                    onPageChange={focusedCaseRowsPagination.setCurrentPage}
                  />
                ) : null}
              </details>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700" onClick={() => openPlanInsights(activePlan)}>View insights</button>
                <button type="button" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => openExecutionForPlan(activePlan)}>Run this plan</button>
                <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600" onClick={() => openAssignModal(getId(activePlan))}>Assign members</button>
              </div>
            </div>
              ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Recent activity</div>
            <div className="mt-3 space-y-2">
              {recentActivity.map((item: RecordAny) => <button key={getId(item)} type="button" onClick={() => selectActivePlan(getId(item))} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:border-slate-300 ${activePlanId === getId(item) ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200"}`}><span><span className="block text-xs text-slate-500">{item.project?.name || "-"}</span><span className="block text-sm font-semibold text-slate-900">{item.name}</span></span><span className="text-xs text-slate-400">{new Date(item.updatedAt || item.createdAt || 0).toLocaleDateString()}</span></button>)}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">Execution runs</div>
                {activePlan ? (
                  <div className="text-[11px] text-slate-500">
                    Focused: {activePlan.name} · {runCountByPlanId.get(getId(activePlan)) || 0} total
                  </div>
                ) : isMultiPlanRunsScope ? (
                  <div className="text-[11px] text-slate-500">
                    From {selectedIds.length} bulk-selected plans
                  </div>
                ) : runsScopePlans.length === 1 ? (
                  <div className="text-[11px] text-slate-500">
                    {runsScopePlans[0]?.name} · {runCountByPlanId.get(getId(runsScopePlans[0])) || 0} total
                  </div>
                ) : null}
              </div>
              {activePlan ? (
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  onClick={() => openAllRunsForPlan(activePlan)}
                >
                  All runs
                </button>
              ) : null}
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {runsScopePlanIds.length === 0 ? (
                <div className="text-slate-500">Focus a plan (click row) or select plans (checkbox) to see runs</div>
              ) : relatedRuns.length === 0 ? (
                <div className="text-slate-500">No runs for selected scope</div>
              ) : (
                relatedRuns.map((run: RecordAny) => {
                  const runPlan = planForRun(run);
                  return (
                  <div key={String(getId(run))} className="rounded-lg border border-slate-200 p-3">
                    {isMultiPlanRunsScope && runPlan ? (
                      <div className="mb-1 truncate text-[11px] font-semibold text-indigo-700">{runPlan.name}</div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 truncate text-slate-900">{run.name || "Run"}</strong>
                      <span
                        className={
                          run.status === "completed"
                            ? "shrink-0 text-emerald-700"
                            : run.status === "running"
                              ? "shrink-0 text-amber-700"
                              : "shrink-0 text-slate-500"
                        }
                      >
                        {run.status || "pending"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        {new Date(run.createdAt || 0).toLocaleString()}
                      </span>
                      {runPlan ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          onClick={() => openRunForPlan(String(getId(run)), runPlan)}
                        >
                          Open
                        </button>
                      ) : null}
                    </div>
                  </div>
                  );
                })
              )}
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
              const result = await createPlan(e);
              if (result) {
                setShowCreateModal(false);
                if (result.created) {
                  setStartRunPromptPlan(result.plan);
                }
              }
            }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <ScopedProjectField
                  isProjectScoped={isProjectScoped}
                  scopedProjectName={scopedProjectName}
                  projectId={String(planForm.projectId || "")}
                  projects={scopedProjects}
                  onProjectChange={(projectId) =>
                    setPlanForm((prev: any) => ({
                      ...prev,
                      projectId,
                      versionId: "",
                      selectedGroupIds: [],
                      caseIds: [],
                    }))
                  }
                  getId={getId}
                />
                <Field label="Version">
                  <select
                    className={INPUT_CLS}
                    value={planForm.versionId}
                    onChange={(e) => setPlanForm((prev: any) => ({ ...prev, versionId: e.target.value }))}
                    required
                  >
                    <option value="">Select version</option>
                    {versionOptions.map((version: RecordAny) => (
                      <option key={getId(version)} value={getId(version)}>{version.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{selectedPlanGroupIds.size} groups · {selectedPlanCaseIds.size} cases</span>
                      </summary>

                      <div className="space-y-2 border-l border-slate-200 px-4 py-3">
                        {planProjectGroups.length === 0 ? (
                          <div className="py-3 text-center text-xs text-slate-400">Không có group nào trong project này.</div>
                        ) : (
                          planProjectGroups.map((group: RecordAny) => {
                            const groupId = getId(group);
                            const checked = selectedPlanGroupIds.has(groupId);
                            const groupCases = planProjectCases.filter((testCase: RecordAny) =>
                              matchesEntityId(testCase.group, group),
                            );

                            return (
                              <label
                                key={groupId}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 rounded accent-emerald-600"
                                  checked={checked}
                                  onChange={() => togglePlanGroup(groupId)}
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <strong className="text-sm font-semibold text-slate-900">{group.name}</strong>
                                  <small className="text-xs text-slate-500">{groupCases.length} test cases</small>
                                </span>
                              </label>
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
                    <p className="mt-0.5 text-xs text-slate-500">Chọn group ở trên, rồi tick test case cần đưa vào plan.</p>
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

                {visibleCases.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">
                    {selectedPlanGroups.length === 0
                      ? "Chọn ít nhất 1 group để hiện test case."
                      : "Các group đã chọn chưa có test case."}
                  </div>
                ) : (
                  <div className="mt-3 space-y-1">
                    {paginatedVisibleCases.map(({ testCase, group }) => {
                      const caseId = getId(testCase);
                      const checked = isEntityReferenceSelected(testCase, selectedPlanCaseIds);
                      return (
                        <label key={caseId} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${checked ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}>
                          <input type="checkbox" className="h-4 w-4 rounded accent-blue-600" checked={checked} onChange={() => togglePlanCase(getId(group), caseId)} />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <strong className="block truncate text-xs font-semibold text-slate-900">{testCase.caseKey} - {testCase.title}</strong>
                            <small className="block truncate text-[11px] text-slate-400">{group.name} · {testCase.description || "No description"}</small>
                          </span>
                        </label>
                      );
                    })}
                    {planCasePickerPagination.hasPagination ? (
                      <ClientPaginationBar
                        currentPage={planCasePickerPagination.currentPage}
                        totalPages={planCasePickerPagination.totalPages}
                        totalItems={planCasePickerPagination.totalItems}
                        onPageChange={planCasePickerPagination.setCurrentPage}
                        className="rounded-lg border border-slate-200"
                      />
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <strong>{selectedPlanCaseIds.size}</strong> case(s) selected from{" "}
                <strong>{selectedPlanGroupIds.size}</strong> group(s)
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
            <h3 className="mb-2 text-lg font-semibold text-slate-900">Assign members</h3>
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

      {startRunPromptPlan ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Test plan created</h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong>{startRunPromptPlan.name || "New plan"}</strong> đã được lưu. Bạn có muốn chạy ngay không?
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  openExecutionForPlan(startRunPromptPlan);
                  setStartRunPromptPlan(null);
                }}
              >
                ▶ Start run now
              </Button>
              <Button type="button" onClick={() => setStartRunPromptPlan(null)}>
                Later
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
