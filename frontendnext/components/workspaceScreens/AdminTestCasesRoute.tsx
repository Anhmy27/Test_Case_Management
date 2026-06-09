"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminTestCasesScreen from "@/components/workspaceScreens/AdminTestCasesScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId, matchesSelectedEntity } from "@/lib/api";

type RecordAny = Record<string, any>;
const MAX_EXCEL_IMPORT_BYTES = 50 * 1024 * 1024;
const EXCEL_IMPORT_EXTENSIONS = [".xls", ".xlsx"];

function generateStepId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminTestCasesRoute() {
  const searchParams = useSearchParams();
  const caseIdFromUrl = String(searchParams.get("caseId") || "").trim();
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [testCaseForm, setTestCaseForm] = useState({ projectId: "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "functional", description: "", expected: "", steps: [{ action: "", expected: "" }] });
  const [automationForm, setAutomationForm] = useState({ enabled: false, webId: "", baseUrl: "", userKey: "", timeoutMs: "30", steps: [{ stepId: "1", stepName: "", action: "goto", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15" }] });
  const [editingTestCaseId, setEditingTestCaseId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const consumedCaseIdRef = useRef<string>("");

  const handleProjectScopeChange = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      setTestCaseForm((prev) => ({ ...prev, projectId }));
    }
  }, [setSelectedProjectId, setTestCaseForm]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const [projectsResponse, groupsResponse, casesResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
        ]);
        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(casesResponse.testCases) ? casesResponse.testCases : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test cases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, token]);

  const refreshAll = async () => {
    const [projectsResponse, groupsResponse, casesResponse] = await Promise.all([
      apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
      apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
      apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
    ]);
    setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
    setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
    setTestCases(Array.isArray(casesResponse.testCases) ? casesResponse.testCases : []);
  };

  const normalizeSteps = (steps: Array<{ action: string; expected?: string | null }>) =>
    steps
      .filter((step) => String(step.action || "").trim())
      .map((step, index) => {
        const stepExpected = String(step.expected || "").trim();
        return {
          order: index + 1,
          action: String(step.action || "").trim(),
          expected: stepExpected || null,
        };
      });
  const normalizeAutomationSteps = (steps: any[]) =>
    steps
      .filter((step) => String(step.action || "").trim())
      .map((step, index) => ({
        stepId: String(step.stepId || "").trim() || String(index + 1),
        stepName: String(step.stepName || "").trim(),
        order: index + 1,
        action: String(step.action || "goto").trim(),
        targetType: String(step.targetType || "css"),
        target: String(step.target || ""),
        value: String(step.value || ""),
        expected: String(step.expected || ""),
        timeoutMs: Number(step.timeoutMs || 15) * 1000,
      }));

  const saveTestCase = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        ...testCaseForm,
        projectId: testCaseForm.projectId || selectedProjectId,
        steps: normalizeSteps(testCaseForm.steps),
        automation: automationForm.enabled
        ? {
            ...automationForm,
            timeoutMs: Number(automationForm.timeoutMs || 30) * 1000,
            steps: normalizeAutomationSteps(automationForm.steps),
          }
        : { enabled: false, timeoutMs: 30000, steps: [] },
      };
      if (editingTestCaseId) {
        await apiRequest(`/api/test-cases/${editingTestCaseId}`, token, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Test case updated");
      } else {
        await apiRequest(`/api/test-cases`, token, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Test case created");
      }
      setEditingTestCaseId("");
      setTestCaseForm({ projectId: selectedProjectId || "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "functional", description: "", expected: "", steps: [{ action: "", expected: "" }] });
      setAutomationForm({ enabled: false, webId: "", baseUrl: "", userKey: "", timeoutMs: "30", steps: [{ stepId: generateStepId(), stepName: "", action: "goto", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15" }] });
      await refreshAll();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save test case");
      return false;
    }
  };

  const cancelTestCaseEdit = () => {
    setEditingTestCaseId("");
    setTestCaseForm({ projectId: selectedProjectId || "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "functional", description: "", expected: "", steps: [{ action: "", expected: "" }] });
    setAutomationForm({ enabled: false, webId: "", baseUrl: "", userKey: "", timeoutMs: "30", steps: [{ stepId: generateStepId(), stepName: "", action: "goto", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15" }] });
  };

  const startTestCaseEdit = useCallback((testCase: RecordAny) => {
    setEditingTestCaseId(getId(testCase));
    setTestCaseForm({
      projectId: getId(testCase.project),
      groupId: getId(testCase.group),
      caseKey: testCase.caseKey || "",
      title: testCase.title || "",
      priority: testCase.priority || "medium",
      severity: testCase.severity || "major",
      type: testCase.type || "functional",
      description: testCase.description || "",
      expected: testCase.expected || "",
      steps: Array.isArray(testCase.steps) && testCase.steps.length
        ? testCase.steps.map((s: RecordAny) => ({ action: String(s.action || ""), expected: String(s.expected || "") }))
        : [{ action: "", expected: "" }],
    });

    const automation = testCase.automation || {};
    const existingSteps = Array.isArray(automation.steps) && automation.steps.length
      ? automation.steps.map((step: RecordAny) => ({
          stepId: String(step.stepId || "").trim() || generateStepId(),
          stepName: String(step.stepName || ""),
          action: String(step.action || "goto"),
          targetType: String(step.targetType || "css"),
          target: String(step.target || ""),
          value: String(step.value || ""),
          expected: String(step.expected || ""),
          timeoutMs: String(Math.round(Number(step.timeoutMs || 15000) / 1000)),
        }))
      : [{ stepId: generateStepId(), stepName: "", action: "goto", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15" }];

    setAutomationForm({
      enabled: Boolean(automation.enabled),
      webId: String(automation.webId || ""),
      baseUrl: String(automation.baseUrl || ""),
      userKey: String(automation.userKey || ""),
      timeoutMs: String(Math.round(Number(automation.timeoutMs || 30000) / 1000)),
      steps: existingSteps,
    });
  }, []);

  useEffect(() => {
    if (!caseIdFromUrl || consumedCaseIdRef.current === caseIdFromUrl || testCases.length === 0) {
      return;
    }

    const matched = testCases.find((testCase) => getId(testCase) === caseIdFromUrl);
    if (!matched) {
      return;
    }

    consumedCaseIdRef.current = caseIdFromUrl;
    const timeoutId = window.setTimeout(() => {
      startTestCaseEdit(matched);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [caseIdFromUrl, startTestCaseEdit, testCases]);

  const deleteTestCase = async (testCaseId: string) => { await apiRequest(`/api/test-cases/${testCaseId}`, token, { method: "DELETE" }); await refreshAll(); };
  const duplicateTestCase = async (testCase: RecordAny) => {
    const payload: RecordAny = {
      projectId: getId(testCase.project) || getId(testCase.projectId) || testCase.projectId || "",
      groupId: getId(testCase.group) || getId(testCase.groupId) || testCase.groupId || "",
      caseKey: `${testCase.caseKey || testCase.key || "CASE"}-COPY`,
      title: `${testCase.title || testCase.name || "Test case"} copy`,
      description: testCase.description || "",
      expected: testCase.expected || "",
      priority: testCase.priority || "medium",
      severity: testCase.severity || "major",
      type: testCase.type || "functional",
      steps: Array.isArray(testCase.steps) ? testCase.steps : [],
      automation: testCase.automation || { enabled: false, steps: [] },
    };
    await apiRequest(`/api/test-cases`, token, { method: "POST", body: JSON.stringify(payload) });
    await refreshAll();
  };
  const deleteTestCases = async (testCaseIds: string[]) => { for (const id of testCaseIds) await deleteTestCase(id); };
  const duplicateTestCases = async (cases: RecordAny[]) => { for (const testCase of cases) await duplicateTestCase(testCase); };
  const addTestCaseStep = () => setTestCaseForm((prev) => ({ ...prev, steps: [...prev.steps, { action: "", expected: "" }] }));
  const updateTestCaseStep = (index: number, key: string, value: string) => setTestCaseForm((prev) => ({ ...prev, steps: prev.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));
  const removeTestCaseStep = (index: number) => setTestCaseForm((prev) => ({ ...prev, steps: prev.steps.filter((_, stepIndex) => stepIndex !== index) }));
  const moveTestCaseStep = (fromIndex: number, toIndex: number) => {
    setTestCaseForm((prev) => {
      const copy = [...prev.steps];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return { ...prev, steps: copy };
    });
  };
  const addAutomationStep = () => setAutomationForm((prev) => ({ ...prev, steps: [...prev.steps, { stepId: generateStepId(), stepName: "", action: "goto", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15" }] }));
  const updateAutomationStep = (index: number, key: string, value: string) => setAutomationForm((prev) => ({ ...prev, steps: prev.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));
  const removeAutomationStep = (index: number) => setAutomationForm((prev) => ({ ...prev, steps: prev.steps.filter((_, stepIndex) => stepIndex !== index) }));
  const moveAutomationStep = (fromIndex: number, toIndex: number) => {
    setAutomationForm((prev) => {
      const copy = [...prev.steps];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return { ...prev, steps: copy };
    });
  };
  const downloadTestCaseTemplate = () => { setMessage("Use import template from backend if available"); };
  const importTestCases = async (file: File) => {
    const normalizedName = String(file?.name || "").toLowerCase();
    const hasValidExtension = EXCEL_IMPORT_EXTENSIONS.some((ext) => normalizedName.endsWith(ext));
    if (!hasValidExtension) {
      setMessage("Only Excel files (.xls, .xlsx) are allowed");
      return;
    }

    if (file.size > MAX_EXCEL_IMPORT_BYTES) {
      setMessage("File size exceeds 50MB limit");
      return;
    }

    const effectiveProjectId = String(selectedProjectId || testCaseForm.projectId || "").trim();
    if (!effectiveProjectId) {
      setMessage("Please select a project scope before importing");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", effectiveProjectId);
    await apiRequest(`/api/test-cases/import`, token, { method: "POST", body: formData });
    setMessage("Excel import completed");
    await refreshAll();
  };

  const scopedProjects = selectedProjectId
    ? projects.filter((project) => matchesSelectedEntity(project, selectedProjectId))
    : projects;
  const scopedGroups = selectedProjectId
    ? groups.filter((group) => matchesSelectedEntity(group.project, selectedProjectId))
    : groups;
  const isProjectScoped = Boolean(selectedProjectId);
  const scopedProjectName = scopedProjects[0]?.name || "";
  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Test Cases</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter cases..."
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
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminTestCasesScreen
          token={token}
          editingTestCaseId={editingTestCaseId}
          testCaseForm={testCaseForm as any}
          setTestCaseForm={setTestCaseForm as any}
          automationForm={automationForm as any}
          setAutomationForm={setAutomationForm as any}
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
          testCases={testCases}
          matchesSearch={matchesSearch}
          startTestCaseEdit={startTestCaseEdit}
          deleteTestCase={deleteTestCase}
          duplicateTestCase={duplicateTestCase}
          deleteTestCases={deleteTestCases}
          duplicateTestCases={duplicateTestCases}
          scopedProjects={scopedProjects}
          scopedGroups={scopedGroups}
          selectedProjectId={selectedProjectId}
          isProjectScoped={isProjectScoped}
          scopedProjectName={scopedProjectName}
          downloadTestCaseTemplate={downloadTestCaseTemplate}
          importTestCases={importTestCases}
          importInputRef={importInputRef}
        />
      )}
    </>
  );
}
