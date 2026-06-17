"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import { collectEntityIds, getId } from "@/lib/api";
import AutomationConfigPanel from "@/components/automation/AutomationConfigPanel";
import AutomationDryRunPanel from "@/components/automation/AutomationDryRunPanel";
import TestCaseWorkbenchModal from "@/components/testCases/TestCaseWorkbenchModal";
import TestCaseVersionsPanel from "@/components/testCases/TestCaseVersionsPanel";
import type { AutomationForm } from "@/lib/automationStepMeta";
import { Button, Field, INPUT_CLS, ScopedProjectField } from "./shared";

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
            ["high", "critical"].includes(String(testCase.priority || "")) ||
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
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveScopedName reads scopedProjects/scopedGroups already listed
  }, [groupFilter, matchesSearch, preset, scopedGroups, scopedProjects, testCases]);

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

          <div className="max-h-155 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No test cases found
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((testCase) => {
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
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              event.stopPropagation();
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
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            {testCase.priority || "medium"}
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
                  })
                )}
              </tbody>
            </table>
          </div>
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
            <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              <button
                type="button"
                onClick={() => setWorkbenchTab("details")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  workbenchTab === "details"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setWorkbenchTab("versions")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  workbenchTab === "versions"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                Versions
              </button>
            </div>
          ) : null}

          {workbenchModal === "edit" && workbenchTab === "versions" ? (
            <TestCaseVersionsPanel testCaseId={String(effectiveActiveId)} />
          ) : (
          <form className="space-y-4" onSubmit={handleSaveTestCase}>
                <div className="grid grid-cols-2 gap-3">
                  <ScopedProjectField
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
                  <Field label="Group">
                    <select
                      value={testCaseForm.groupId}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          groupId: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
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
                  </Field>
                </div>

                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <Field label="Case key">
                    <input
                      value={testCaseForm.caseKey}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          caseKey: e.target.value.toUpperCase(),
                        }))
                      }
                      className={`${INPUT_CLS} font-mono uppercase`}
                      placeholder="TC-001"
                      required
                    />
                  </Field>
                  <Field label="Tiêu đề">
                    <input
                      value={testCaseForm.title}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                      placeholder="Mô tả ngắn về test case..."
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Priority">
                    <select
                      value={testCaseForm.priority || "medium"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </Field>
                  <Field label="Severity">
                    <select
                      value={testCaseForm.severity || "major"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          severity: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </Field>
                  <Field label="Type">
                    <select
                      value={testCaseForm.type || "functional"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                    >
                      <option value="functional">Functional</option>
                      <option value="api">API</option>
                      <option value="ui">UI</option>
                      <option value="regression">Regression</option>
                      <option value="security">Security</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                </div>

                <Field label="Mô tả">
                  <textarea
                    rows={2}
                    value={testCaseForm.description}
                    onChange={(e) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className={`${INPUT_CLS} resize-none`}
                    placeholder="Mô tả thêm về mục đích test case này..."
                  />
                </Field>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                        Các bước thực hiện
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Kéo nút ≡ để sắp xếp lại thứ tự
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      label="+ Thêm bước"
                      onClick={addTestCaseStep}
                    />
                  </div>
                  <div className="mt-3 space-y-2">
                    {testCaseForm.steps.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                        onDragOver={handleManualStepDragOver}
                        onDrop={(event) =>
                          handleManualStepDrop(index, event)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="cursor-grab rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
                              draggable
                              onDragStart={(event) =>
                                handleManualStepDragStart(index, event)
                              }
                              onDragEnd={handleManualStepDragEnd}
                              aria-label="Kéo để sắp xếp lại"
                              title="Kéo để sắp xếp lại"
                            >
                              ≡
                            </button>
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                              Bước {index + 1}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            label="Xóa"
                            onClick={() => removeTestCaseStep(index)}
                          />
                        </div>
                        <div className="mt-2">
                          <Field label="Mô tả thao tác">
                            <textarea
                              rows={2}
                              value={step.action}
                              onChange={(e) =>
                                updateTestCaseStep(index, "action", e.target.value)
                              }
                              placeholder="Nhập thao tác cần thực hiện..."
                              className={`${INPUT_CLS} resize-none`}
                            />
                          </Field>
                        </div>
                        <div className="mt-2">
                          <Field label="Kết quả mong đợi của bước này (tùy chọn)">
                            <input
                              value={step.expected || ""}
                              onChange={(e) =>
                                updateTestCaseStep(index, "expected", e.target.value)
                              }
                              placeholder="Ví dụ: Hiển thị thông báo thành công..."
                              className={INPUT_CLS}
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                  {testCaseForm.steps.length === 0 && (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-zinc-600 dark:text-zinc-400">
                      Chưa có bước nào. Nhấn &quot;+ Thêm bước&quot; để bắt đầu.
                    </div>
                  )}
                </div>

                <Field label="Kết quả mong đợi (tổng quan, tùy chọn)">
                  <textarea
                    rows={2}
                    value={testCaseForm.expected}
                    onChange={(e) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        expected: e.target.value,
                      }))
                    }
                    className={`${INPUT_CLS} resize-none`}
                    placeholder="Mô tả kết quả mong đợi sau khi thực hiện test case..."
                  />
                </Field>

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


                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1 justify-center"
                    label={
                      workbenchModal === "edit"
                        ? "+ Save changes"
                        : "+ Create test case"
                    }
                  />
                  {(workbenchModal === "edit" || workbenchModal === "create") && (
                    <Button
                      type="button"
                      size="lg"
                      label="Cancel"
                      onClick={closeWorkbench}
                    />
                  )}
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
                allRecentCases.map((item) => {
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
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                          {item.priority || "medium"}
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
          </div>
        </div>
      )}
    </div>
  );
}
