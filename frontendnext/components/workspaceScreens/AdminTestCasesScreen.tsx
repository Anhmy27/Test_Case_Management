"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import { collectEntityIds, getId } from "@/lib/api";
import { priorityBadgeClass } from "@/lib/testCaseBadges";
import {
  formatPriorityLabel,
  isHighRiskPriority,
  normalizePriorityForForm,
  TEST_CASE_PRIORITY_OPTIONS,
} from "@/lib/testCasePriority";
import { compareTestCaseKeys } from "@/lib/testCaseSort";
import AutomationConfigPanel from "@/components/automation/AutomationConfigPanel";
import AutomationDryRunPanel from "@/components/automation/AutomationDryRunPanel";
import TestCaseWorkbenchModal from "@/components/testCases/TestCaseWorkbenchModal";
import TestCaseVersionsPanel from "@/components/testCases/TestCaseVersionsPanel";
import type { AutomationForm } from "@/lib/automationStepMeta";
import { Button, ClientPaginationBar, ScrollableTable, useClientPagination, WorkbenchField, WORKBENCH_INPUT_CLS, WORKBENCH_LABEL_CLS, WORKBENCH_META_CLS, WORKBENCH_SELECT_CLS, WORKBENCH_TEXTAREA_CLS, WorkbenchSection, ScopedProjectField } from "./shared";

type RecordAny = Record<string, any>;

type TestCaseForm = {
  projectId: string;
  groupId: string;
  caseKey: string;
  title: string;
  priority: string;
  severity: string;
  type: string;
  description: string;
  expected: string;
  steps: Array<{ action: string; expected?: string }>;
};


type Props = {
  editingTestCaseId: string;
  testCaseForm: TestCaseForm;
  setTestCaseForm: Dispatch<SetStateAction<TestCaseForm>>;
  automationForm: AutomationForm;
  setAutomationForm: Dispatch<SetStateAction<AutomationForm>>;
  addTestCaseStep: () => void;
  updateTestCaseStep: (index: number, key: string, value: string) => void;
  removeTestCaseStep: (index: number) => void;
  moveTestCaseStep: (fromIndex: number, toIndex: number) => void;
  addAutomationStep: () => void;
  updateAutomationStep: (index: number, key: string, value: string) => void;
  removeAutomationStep: (index: number) => void;
  moveAutomationStep: (fromIndex: number, toIndex: number) => void;
  saveTestCase: (event: React.FormEvent) => Promise<boolean | void>;
  cancelTestCaseEdit: () => void;
  testCases: RecordAny[];
  matchesSearch: (
    ...values: Array<string | number | undefined | null>
  ) => boolean;
  startTestCaseEdit: (testCase: RecordAny) => void;
  deleteTestCase: (testCaseId: string) => void;
  duplicateTestCase: (testCase: RecordAny) => Promise<void>;
  deleteTestCases: (testCaseIds: string[]) => Promise<void>;
  duplicateTestCases: (testCases: RecordAny[]) => Promise<void>;
  scopedProjects: RecordAny[];
  scopedGroups: RecordAny[];
  selectedProjectId: string;
  isProjectScoped: boolean;
  scopedProjectName?: string;
  downloadTestCaseTemplate: () => void;
  importTestCases: (file: File) => Promise<void>;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
};

type FilterPreset = "all" | "high-risk" | "automation" | "manual" | "recent";
type ManualDragPayload = { index: number };

const compareTestCaseListOrder = (
  left: RecordAny,
  right: RecordAny,
  preset: FilterPreset,
) => {
  if (preset === "recent") {
    return (
      new Date(right.updatedAt || right.createdAt || 0).getTime() -
      new Date(left.updatedAt || left.createdAt || 0).getTime()
    );
  }

  return compareTestCaseKeys(left, right);
};

export default function AdminTestCasesScreen(props: Props) {
  const {
    editingTestCaseId,
    testCaseForm,
    setTestCaseForm,
    automationForm,
    setAutomationForm,
    addTestCaseStep,
    updateTestCaseStep,
    removeTestCaseStep,
    moveTestCaseStep,
    addAutomationStep,
    updateAutomationStep,
    removeAutomationStep,
    moveAutomationStep,
    saveTestCase,
    cancelTestCaseEdit,
    testCases,
    matchesSearch,
    startTestCaseEdit,
    deleteTestCase,
    duplicateTestCase,
    deleteTestCases,
    duplicateTestCases,
    scopedProjects,
    scopedGroups,
    selectedProjectId,
    isProjectScoped,
    scopedProjectName,
    downloadTestCaseTemplate,
    importTestCases,
    importInputRef,
  } = props;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [workbenchModal, setWorkbenchModal] = useState<
    "edit" | "create" | null
  >(null);
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [draggingStep, setDraggingStep] = useState<ManualDragPayload | null>(null);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<"details" | "versions">("details");
  const resolveScopedValue = (value: RecordAny, items: RecordAny[]) => {
    const candidateIds = collectEntityIds(value);
    if (typeof value === "string") {
      candidateIds.add(String(value).trim());
    }

    return (
      items.find((item) => {
        const itemIds = collectEntityIds(item);
        for (const itemId of itemIds) {
          if (candidateIds.has(itemId)) {
            return true;
          }
        }
        return false;
      }) || null
    );
  };

  const resolveScopedName = (value: RecordAny, items: RecordAny[]) => {
    const match = resolveScopedValue(value, items);
    const fallbackValue = typeof value === "string" ? value : getId(value);
    return String(
      match?.name || value?.name || value?.title || fallbackValue || "-",
    );
  };

  const effectiveActiveId = editingTestCaseId || activeId;

  const filteredCases = useMemo(() => {
    return testCases
      .filter((testCase) =>
        matchesSearch(
          testCase.caseKey,
          testCase.title,
          resolveScopedName(testCase.project, scopedProjects),
          resolveScopedName(testCase.group, scopedGroups),
        ),
      )
      .filter((testCase) => {
        if (groupFilter && getId(testCase.group) !== groupFilter) {
          return false;
        }
        if (preset === "all") return true;
        if (preset === "automation")
          return Boolean(testCase.automation?.enabled);
        if (preset === "manual") return !testCase.automation?.enabled;
        if (preset === "high-risk") {
          return (
            isHighRiskPriority(testCase.priority) ||
            String(testCase.severity || "") === "critical"
          );
        }
        if (preset === "recent") {
          const updated = new Date(
            testCase.updatedAt || testCase.createdAt || 0,
          ).getTime();
          return updated > 0;
        }
        return true;
      })
      .sort((left, right) => compareTestCaseListOrder(left, right, preset));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveScopedName reads scopedProjects/scopedGroups already listed
  }, [groupFilter, matchesSearch, preset, scopedGroups, scopedProjects, testCases]);

  const caseListResetKey = `${preset}|${groupFilter}|${filteredCases.length}`;
  const caseListPagination = useClientPagination(filteredCases, 15, caseListResetKey);
  const paginatedCases = caseListPagination.visibleItems;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    filteredCases.length > 0 &&
    filteredCases.every((testCase) => selectedSet.has(getId(testCase)));

  const recentCases = useMemo(() => {
    return [...testCases]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 5);
  }, [testCases]);

  const allRecentCases = useMemo(() => {
    return [...testCases].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );
  }, [testCases]);
  const recentModalPagination = useClientPagination(allRecentCases, 12, allRecentCases.length);
  const paginatedRecentCases = recentModalPagination.visibleItems;

  const presetButtons: Array<{ key: FilterPreset; label: string }> = [
    { key: "all", label: "All" },
    { key: "high-risk", label: "High risk" },
    { key: "automation", label: "Automation" },
    { key: "manual", label: "Manual" },
    { key: "recent", label: "Recent" },
  ];

  const parseManualDragIndex = (data: string): number | null => {
    const index = Number(data);
    return Number.isInteger(index) ? index : null;
  };

  const handleManualStepDragStart = (
    index: number,
    event: React.DragEvent<HTMLElement>,
  ) => {
    setDraggingStep({ index });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleManualStepDragEnd = () => setDraggingStep(null);

  const handleManualStepDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleManualStepDrop = (
    toIndex: number,
    event: React.DragEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    const fromIndex =
      draggingStep?.index ?? parseManualDragIndex(event.dataTransfer.getData("text/plain"));
    if (fromIndex === null || fromIndex === toIndex) return;
    moveTestCaseStep(fromIndex, toIndex);
    setDraggingStep(null);
  };

  const closeWorkbench = () => {
    cancelTestCaseEdit();
    setWorkbenchModal(null);
    setWorkbenchTab("details");
  };

  const openEdit = (testCase: RecordAny) => {
    startTestCaseEdit(testCase);
    setActiveId(getId(testCase));
    setWorkbenchTab("details");
    setWorkbenchModal("edit");
  };

  const openCreate = () => {
    cancelTestCaseEdit();
    setWorkbenchModal("create");
  };

  const switchWorkbenchCase = (testCase: RecordAny) => {
    setActiveId(getId(testCase));
    startTestCaseEdit(testCase);
    setWorkbenchTab("details");
  };

  const handleSaveTestCase = async (event: React.FormEvent) => {
    const saved = await saveTestCase(event);
    if (saved === true) {
      setWorkbenchModal(null);
    }
  };

  useEffect(() => {
    if (!editingTestCaseId || workbenchModal !== null) {
      return;
    }
    setActiveId(editingTestCaseId);
    setWorkbenchModal("edit");
  }, [editingTestCaseId, workbenchModal]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Test Case Workbench
            </div>
            <div className="text-xs text-slate-500">
              Nhanh chong tim, xem, tao va duplicate test case
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={openCreate}
            >
              + New test case
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              onClick={downloadTestCaseTemplate}
            >
              Download template
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              onClick={() => importInputRef.current?.click()}
              disabled={!selectedProjectId}
            >
              Import Excel
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (event) => {
                const input = event.currentTarget as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                await importTestCases(file);
                input.value = "";
              }}
            />
            <span className="text-xs text-slate-500">
              Excel only (.xls, .xlsx), max 50MB
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Saved filters
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presetButtons.map((button) => (
              <button
                key={button.key}
                type="button"
                onClick={() => setPreset(button.key)}
                className={
                  preset === button.key
                    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }
              >
                {button.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              <option value="">All groups</option>
              {scopedGroups.map((group) => (
                <option key={getId(group)} value={getId(group)}>
                  {group.name}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {filteredCases.length} cases
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm font-semibold text-slate-900">
                Test case list
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  onClick={async () => {
                    const selected = filteredCases.filter((item) =>
                      selectedSet.has(getId(item)),
                    );
                    if (selected.length === 0) return;
                    await duplicateTestCases(selected);
                  }}
                >
                  ⧉ Duplicate selected
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                  onClick={async () => {
                    if (selectedIds.length === 0) return;
                    await deleteTestCases(selectedIds);
                    setSelectedIds([]);
                  }}
                >
                  🗑 Delete selected
                </button>
              </div>
            </div>
          </div>

          <ScrollableTable
            colWidths={["3rem", "22%", "18%", "10%", "10%", "12%", "18%"]}
            isEmpty={filteredCases.length === 0}
            emptyContent={
              <div className="px-4 py-6 text-center text-sm text-slate-500">No test cases found</div>
            }
            footer={
              caseListPagination.hasPagination ? (
                <ClientPaginationBar
                  currentPage={caseListPagination.currentPage}
                  totalPages={caseListPagination.totalPages}
                  totalItems={caseListPagination.totalItems}
                  onPageChange={caseListPagination.setCurrentPage}
                />
              ) : null
            }
            headRow={
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {
                      if (allVisibleSelected) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(
                          filteredCases.map((item) => getId(item)),
                        );
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Project / Group</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Automation</th>
                <th className="px-4 py-3 text-right">Quick actions</th>
              </tr>
            }
          >
            {paginatedCases.map((testCase) => {
              const caseId = getId(testCase);
              const selected = selectedSet.has(caseId);
              return (
                <tr
                  key={caseId}
                  className={`cursor-pointer transition hover:bg-slate-50 ${
                    String(effectiveActiveId) === caseId
                      ? "bg-slate-50"
                      : ""
                  }`}
                  onClick={() => openEdit(testCase)}
                >
                  <td
                    className="px-4 py-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setSelectedIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== caseId)
                            : [...prev, caseId],
                        );
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">
                      {testCase.caseKey}
                    </div>
                    <div className="text-xs text-slate-500">
                      {testCase.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-700">
                      {resolveScopedName(
                        testCase.project,
                        scopedProjects,
                      )}
                    </div>
                    <div>
                      {resolveScopedName(testCase.group, scopedGroups)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={priorityBadgeClass(testCase.priority)}>
                      {formatPriorityLabel(testCase.priority)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {testCase.type || "functional"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        testCase.automation?.enabled
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                      }
                    >
                      {testCase.automation?.enabled
                        ? "Enabled"
                        : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(testCase);
                        }}
                      >
                        ✎ Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          void duplicateTestCase(testCase);
                        }}
                      >
                        ⧉ Duplicate
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteTestCase(caseId);
                        }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </ScrollableTable>
        </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Recent activity
            </div>
            <div className="text-xs text-slate-500">
              5 test case gan nhat
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            onClick={() => setShowRecentModal(true)}
          >
            View all
          </button>
        </div>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {recentCases.map((item) => (
            <button
              key={getId(item)}
              type="button"
              onClick={() => openEdit(item)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-slate-300"
            >
              <span>
                <span className="block text-xs text-slate-500">
                  {item.caseKey}
                </span>
                <span className="block text-sm font-semibold text-slate-900">
                  {item.title}
                </span>
              </span>
              <span className="text-xs text-slate-400">
                {new Date(
                  item.updatedAt || item.createdAt || 0,
                ).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      </section>

      {workbenchModal && (
        <TestCaseWorkbenchModal
          mode={workbenchModal}
          onClose={closeWorkbench}
          cases={filteredCases}
          activeCaseId={String(effectiveActiveId)}
          onSelectCase={switchWorkbenchCase}
        >
          {workbenchModal === "edit" ? (
            <div className="mb-2 flex flex-wrap gap-1 border-b border-slate-100 pb-1.5">
              <button
                type="button"
                onClick={() => setWorkbenchTab("details")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  workbenchTab === "details"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setWorkbenchTab("versions")}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  workbenchTab === "versions"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Versions
              </button>
            </div>
          ) : null}

          {workbenchModal === "edit" && workbenchTab === "versions" ? (
            <TestCaseVersionsPanel testCaseId={String(effectiveActiveId)} />
          ) : (
          <form
            className="test-case-workbench-form space-y-4"
            onSubmit={handleSaveTestCase}
          >
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                <div className="grid grid-cols-2 gap-3">
                  <ScopedProjectField
                    variant="workbench"
                    isProjectScoped={isProjectScoped}
                    scopedProjectName={scopedProjectName}
                    projectId={testCaseForm.projectId}
                    projects={scopedProjects}
                    onProjectChange={(projectId) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        projectId,
                        groupId: "",
                      }))
                    }
                    getId={getId}
                  />
                  <WorkbenchField label="Group">
                    <select
                      value={testCaseForm.groupId}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          groupId: e.target.value,
                        }))
                      }
                      className={WORKBENCH_SELECT_CLS}
                      required
                    >
                      <option value="">Chọn group</option>
                      {scopedGroups
                        .filter((g) =>
                          !testCaseForm.projectId ||
                          String(getId(g.project) || "") === testCaseForm.projectId,
                        )
                        .map((group) => (
                          <option key={getId(group)} value={getId(group)}>
                            {group.name}
                          </option>
                        ))}
                    </select>
                  </WorkbenchField>
                </div>

                <div className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                  <WorkbenchField label="Case key">
                    <input
                      value={testCaseForm.caseKey}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          caseKey: e.target.value.toUpperCase(),
                        }))
                      }
                      className={`${WORKBENCH_INPUT_CLS} font-mono uppercase`}
                      placeholder="TC-001"
                      required
                    />
                  </WorkbenchField>
                  <WorkbenchField label="Tiêu đề">
                    <input
                      value={testCaseForm.title}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className={WORKBENCH_INPUT_CLS}
                      placeholder="Mô tả ngắn..."
                      required
                    />
                  </WorkbenchField>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <WorkbenchField label="Priority">
                    <select
                      value={normalizePriorityForForm(testCaseForm.priority)}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                      className={WORKBENCH_SELECT_CLS}
                    >
                      {TEST_CASE_PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </WorkbenchField>
                  <WorkbenchField label="Severity">
                    <select
                      value={testCaseForm.severity || "major"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          severity: e.target.value,
                        }))
                      }
                      className={WORKBENCH_SELECT_CLS}
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </WorkbenchField>
                  <WorkbenchField label="Type">
                    <select
                      value={testCaseForm.type || "functional"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className={WORKBENCH_SELECT_CLS}
                    >
                      <option value="functional">Functional</option>
                      <option value="api">API</option>
                      <option value="ui">UI</option>
                      <option value="regression">Regression</option>
                      <option value="security">Security</option>
                      <option value="other">Other</option>
                    </select>
                  </WorkbenchField>
                </div>

                <div className="mt-3">
                <WorkbenchField label="Mô tả">
                  <textarea
                    rows={2}
                    value={testCaseForm.description}
                    onChange={(e) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className={WORKBENCH_TEXTAREA_CLS}
                    placeholder="Mục đích test case..."
                  />
                </WorkbenchField>
                </div>
                </div>

                <WorkbenchSection
                  title="Các bước thực hiện"
                  hint="Kéo ≡ để đổi thứ tự"
                  tone="manual"
                  action={
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={addTestCaseStep}
                    >
                      + Thêm bước
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {testCaseForm.steps.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
                        onDragOver={handleManualStepDragOver}
                        onDrop={(event) => handleManualStepDrop(index, event)}
                      >
                        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1">
                          <button
                            type="button"
                            className={`${WORKBENCH_META_CLS} cursor-grab rounded border border-slate-200 px-1 py-px text-slate-500 hover:text-slate-700`}
                            draggable
                            onDragStart={(event) => handleManualStepDragStart(index, event)}
                            onDragEnd={handleManualStepDragEnd}
                            aria-label="Kéo để sắp xếp lại"
                          >
                            ≡
                          </button>
                          <span className="w-3 text-center text-[10px] font-medium tabular-nums text-slate-600">
                            {index + 1}
                          </span>
                          <input
                            value={step.action}
                            onChange={(e) => updateTestCaseStep(index, "action", e.target.value)}
                            placeholder="Mô tả thao tác..."
                            className={WORKBENCH_INPUT_CLS}
                          />
                          <button
                            type="button"
                            className={`${WORKBENCH_META_CLS} rounded border border-rose-100 px-1.5 py-px text-rose-600 hover:bg-rose-50`}
                            onClick={() => removeTestCaseStep(index)}
                          >
                            Xóa
                          </button>
                        </div>
                        <label className="mt-1.5 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
                          <span className={WORKBENCH_LABEL_CLS}>KQ bước</span>
                          <input
                            value={step.expected || ""}
                            onChange={(e) => updateTestCaseStep(index, "expected", e.target.value)}
                            placeholder="Tùy chọn"
                            className={WORKBENCH_INPUT_CLS}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  {testCaseForm.steps.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
                      Chưa có bước. Nhấn &quot;+ Thêm bước&quot;.
                    </div>
                  )}

                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
                    <WorkbenchField label="KQ mong đợi (tổng quan)">
                      <input
                        value={testCaseForm.expected}
                        onChange={(e) =>
                          setTestCaseForm((prev) => ({
                            ...prev,
                            expected: e.target.value,
                          }))
                        }
                        className={WORKBENCH_INPUT_CLS}
                        placeholder="Kết quả mong đợi sau khi thực hiện các bước thủ công"
                      />
                    </WorkbenchField>
                  </div>
                </WorkbenchSection>

                <AutomationConfigPanel
                  automationForm={automationForm}
                  setAutomationForm={setAutomationForm}
                  addAutomationStep={addAutomationStep}
                  updateAutomationStep={updateAutomationStep}
                  removeAutomationStep={removeAutomationStep}
                  moveAutomationStep={moveAutomationStep}
                />

                {automationForm.enabled ? (
                  <AutomationDryRunPanel
                    automationForm={automationForm}
                    testCaseId={editingTestCaseId}
                  />
                ) : null}


                <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
                  <Button
                    type="button"
                    size="sm"
                    label="Cancel"
                    onClick={closeWorkbench}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    label={
                      workbenchModal === "edit"
                        ? "Save changes"
                        : "Create test case"
                    }
                  />
                </div>
          </form>
          )}
        </TestCaseWorkbenchModal>
      )}

      {showRecentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowRecentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>

            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent activity
              </div>
              <h3 className="text-xl font-semibold text-slate-900">
                All test cases by recency
              </h3>
              <div className="text-sm text-slate-600">
                Showing {allRecentCases.length} test cases with details, last
                update time, and automation context.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {allRecentCases.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No test cases found.
                </div>
              ) : (
                paginatedRecentCases.map((item) => {
                  const stepCount = Array.isArray(item.steps)
                    ? item.steps.length
                    : 0;
                  return (
                    <button
                      key={getId(item)}
                      type="button"
                      onClick={() => {
                        openEdit(item);
                        setShowRecentModal(false);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.caseKey || item.key}
                          </div>
                          <div className="text-base font-semibold text-slate-900">
                            {item.title || item.name}
                          </div>
                        </div>
                        <span
                          className={
                            item.automation?.enabled
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                          }
                        >
                          {item.automation?.enabled ? "Automation" : "Manual"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className={priorityBadgeClass(item.priority)}>
                          {formatPriorityLabel(item.priority)}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                          {item.severity || "major"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                          {item.type || "functional"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-slate-500">Project</div>
                          <div className="font-semibold text-slate-800">
                            {item.project?.name || "-"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-slate-500">Group</div>
                          <div className="font-semibold text-slate-800">
                            {item.group?.name || "-"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-slate-500">Steps</div>
                          <div className="font-semibold text-slate-800">
                            {stepCount}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2">
                          <div className="text-slate-500">Updated</div>
                          <div className="font-semibold text-slate-800">
                            {new Date(
                              item.updatedAt || item.createdAt || 0,
                            ).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {recentModalPagination.hasPagination ? (
              <ClientPaginationBar
                currentPage={recentModalPagination.currentPage}
                totalPages={recentModalPagination.totalPages}
                totalItems={recentModalPagination.totalItems}
                onPageChange={recentModalPagination.setCurrentPage}
                className="mt-4 rounded-xl border border-slate-200"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
