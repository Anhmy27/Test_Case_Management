"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import { getId } from "@/lib/api";
import AutomationConfigPanel from "@/components/automation/AutomationConfigPanel";
import AutomationDryRunPanel from "@/components/automation/AutomationDryRunPanel";
import type { AutomationForm } from "@/lib/automationStepMeta";

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
  token: string;
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
  saveTestCase: (event: React.FormEvent) => Promise<void>;
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
  downloadTestCaseTemplate: () => void;
  importTestCases: (file: File) => Promise<void>;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
};

type FilterPreset = "all" | "high-risk" | "automation" | "manual" | "recent";
type ManualDragPayload = { index: number };

export default function AdminTestCasesScreen(props: Props) {
  const {
    token,
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
    downloadTestCaseTemplate,
    importTestCases,
    importInputRef,
  } = props;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [panelMode, setPanelMode] = useState<"view" | "edit" | "create">(
    "view",
  );
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [draggingStep, setDraggingStep] = useState<ManualDragPayload | null>(null);
  const [showRecentModal, setShowRecentModal] = useState(false);
  const resolveScopedValue = (value: RecordAny, items: RecordAny[]) => {
    const candidateIds = new Set(
      [getId(value), typeof value === "string" ? value : ""]
        .concat(
          typeof value === "object" && value !== null
            ? [
                String(value._id || ""),
                String(value.entityId || ""),
                String(value.id || ""),
              ]
            : [],
        )
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    );

    return (
      items.find((item) => {
        const itemIds = [
          getId(item),
          String(item?._id || ""),
          String(item?.entityId || ""),
          String(item?.id || ""),
        ]
          .map((itemId) => String(itemId || "").trim())
          .filter(Boolean);

        return itemIds.some((itemId) => candidateIds.has(itemId));
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

  const activeCase = useMemo(
    () =>
      testCases.find((testCase) => getId(testCase) === String(activeId)) ||
      testCases.find(
        (testCase) => getId(testCase) === String(effectiveActiveId),
      ) ||
      (filteredCases.length > 0 ? filteredCases[0] : null),
    [activeId, effectiveActiveId, filteredCases, testCases],
  );

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
              onClick={() => {
                cancelTestCaseEdit();
                setPanelMode("create");
              }}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                        onClick={() => setActiveId(caseId)}
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
                                setActiveId(caseId);
                                setPanelMode("view");
                              }}
                            >
                              ↗ View
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                startTestCaseEdit(testCase);
                                setPanelMode("edit");
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

        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="flex max-h-[calc(100vh-96px)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {panelMode === "edit"
                    ? "Edit test case"
                    : panelMode === "create"
                      ? "New test case"
                      : "Case details"}
                </div>
                <div className="text-xs text-slate-500">
                  {panelMode === "view"
                    ? "Quick context and actions"
                    : "Edit fields and save"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {panelMode !== "create" && activeCase && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => {
                      startTestCaseEdit(activeCase);
                      setPanelMode("edit");
                    }}
                  >
                    ✎ Edit
                  </button>
                )}
                {panelMode !== "create" && activeCase && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    onClick={() => void duplicateTestCase(activeCase)}
                  >
                    ⧉ Duplicate
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {panelMode === "view" && activeCase ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Case
                  </div>
                  <div className="text-lg font-semibold text-slate-900">
                    {activeCase.caseKey}
                  </div>
                  <div className="text-sm text-slate-600">
                    {activeCase.title}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                    {activeCase.priority || "medium"}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {activeCase.severity || "major"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {activeCase.type || "functional"}
                  </span>
                  <span
                    className={
                      activeCase.automation?.enabled
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                    }
                  >
                    {activeCase.automation?.enabled ? "Automation" : "Manual"}
                  </span>
                </div>

                {activeCase.description && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    {activeCase.description}
                  </div>
                )}

                {activeCase.expected && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expected result
                    </div>
                    <div className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {activeCase.expected}
                    </div>
                  </div>
                )}

                {Array.isArray(activeCase.steps) && activeCase.steps.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Manual Steps ({activeCase.steps.length})
                    </div>
                    <ol className="mt-2 space-y-2">
                      {(activeCase.steps as RecordAny[]).map((step, index) => (
                        <li
                          key={index}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                              #{index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-slate-800">{step.action}</div>
                              {step.expected && (
                                <div className="mt-1 text-[11px] text-emerald-700">
                                  → {step.expected}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {activeCase.automation?.enabled && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Automation ({(activeCase.automation?.steps || []).length} bước)
                    </div>
                    <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {activeCase.automation?.webId && (
                        <div>Web ID: {activeCase.automation.webId}</div>
                      )}
                      {activeCase.automation?.baseUrl && (
                        <div>URL: {activeCase.automation.baseUrl}</div>
                      )}
                      {activeCase.automation?.userKey && (
                        <div>Profile: {activeCase.automation.userKey}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <form className="space-y-4" onSubmit={saveTestCase}>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-500">
                    Project
                    <select
                      value={testCaseForm.projectId}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          projectId: e.target.value,
                          groupId: "",
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Chọn project</option>
                      {scopedProjects.map((project) => (
                        <option key={getId(project)} value={getId(project)}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Group
                    <select
                      value={testCaseForm.groupId}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          groupId: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                  </label>
                </div>

                <div className="grid grid-cols-[110px_1fr] gap-3">
                  <label className="text-xs font-semibold text-slate-500">
                    Case key
                    <input
                      value={testCaseForm.caseKey}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          caseKey: e.target.value.toUpperCase(),
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase"
                      placeholder="TC-001"
                      required
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Tiêu đề
                    <input
                      value={testCaseForm.title}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Mô tả ngắn về test case..."
                      required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="text-xs font-semibold text-slate-500">
                    Priority
                    <select
                      value={testCaseForm.priority || "medium"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          priority: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Severity
                    <select
                      value={testCaseForm.severity || "major"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          severity: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Type
                    <select
                      value={testCaseForm.type || "functional"}
                      onChange={(e) =>
                        setTestCaseForm((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="functional">Functional</option>
                      <option value="api">API</option>
                      <option value="ui">UI</option>
                      <option value="regression">Regression</option>
                      <option value="security">Security</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>

                <label className="text-xs font-semibold text-slate-500">
                  Mô tả
                  <textarea
                    rows={2}
                    value={testCaseForm.description}
                    onChange={(e) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Mô tả thêm về mục đích test case này..."
                  />
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">
                        Các bước thực hiện
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Kéo nút ≡ để sắp xếp lại thứ tự
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      onClick={addTestCaseStep}
                    >
                      + Thêm bước
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {testCaseForm.steps.map((step, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                        onDragOver={handleManualStepDragOver}
                        onDrop={(event) =>
                          handleManualStepDrop(index, event)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="cursor-grab rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-600"
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
                            <span className="text-[11px] font-semibold text-slate-400">
                              Bước {index + 1}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-100"
                            onClick={() => removeTestCaseStep(index)}
                          >
                            Xóa
                          </button>
                        </div>
                        <div className="mt-2">
                          <label className="text-[11px] font-semibold text-slate-500">
                            Mô tả thao tác
                            <textarea
                              rows={2}
                              value={step.action}
                              onChange={(e) =>
                                updateTestCaseStep(index, "action", e.target.value)
                              }
                              placeholder="Nhập thao tác cần thực hiện..."
                              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                        <div className="mt-2">
                          <label className="text-[11px] font-semibold text-slate-500">
                            Kết quả mong đợi của bước này (tùy chọn)
                            <input
                              value={step.expected || ""}
                              onChange={(e) =>
                                updateTestCaseStep(index, "expected", e.target.value)
                              }
                              placeholder="Ví dụ: Hiển thị thông báo thành công..."
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  {testCaseForm.steps.length === 0 && (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                      Chưa có bước nào. Nhấn &quot;+ Thêm bước&quot; để bắt đầu.
                    </div>
                  )}
                </div>

                <label className="text-xs font-semibold text-slate-500">
                  Kết quả mong đợi (tổng quan)
                  <textarea
                    rows={2}
                    value={testCaseForm.expected}
                    onChange={(e) =>
                      setTestCaseForm((prev) => ({
                        ...prev,
                        expected: e.target.value,
                      }))
                    }
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Mô tả kết quả mong đợi sau khi thực hiện test case..."
                    required
                  />
                </label>

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
                    token={token}
                    automationForm={automationForm}
                    testCaseId={editingTestCaseId}
                  />
                ) : null}


                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    {panelMode === "edit"
                      ? "+ Save changes"
                      : "+ Create test case"}
                  </button>
                  {panelMode === "edit" && (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      onClick={() => {
                        cancelTestCaseEdit();
                        setPanelMode("view");
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
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
                  onClick={() => setActiveId(getId(item))}
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
        </aside>
      </div>

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
                        setActiveId(getId(item));
                        setPanelMode("view");
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
