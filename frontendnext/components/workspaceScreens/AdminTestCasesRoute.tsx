"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminTestCasesScreen from "@/components/workspaceScreens/AdminTestCasesScreen";
import { apiRequest, createTextMatcher, getId, matchesSelectedEntity, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;

function storedToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || "";
}

function storedProject() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || "";
}

export default function AdminTestCasesRoute() {
  const router = useRouter();
  const [token] = useState<string>(() => storedToken());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "test-cases", router);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [testCaseForm, setTestCaseForm] = useState({ projectId: "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "manual", description: "", expected: "", steps: [{ action: "" }] });
  const [automationForm, setAutomationForm] = useState({ enabled: false, baseUrl: "", userKey: "", steps: [{ action: "", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15000" }] });
  const [editingTestCaseId, setEditingTestCaseId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (typeof window !== "undefined") { if (selectedProjectId) window.localStorage.setItem("tcm_selected_project_id", selectedProjectId); else window.localStorage.removeItem("tcm_selected_project_id"); } }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    setTestCaseForm((prev) =>
      prev.projectId === selectedProjectId
        ? prev
        : { ...prev, projectId: selectedProjectId },
    );
  }, [selectedProjectId]);

  useEffect(() => {
    if (!token) { router.replace("/"); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        if (!me.user) { router.replace("/"); return; }
        if (me.user.role !== "admin") { router.replace("/workspace/employee/my-test-plans"); return; }
        const [projectsResponse, groupsResponse, casesResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
        ]);
        if (cancelled) return;
        setCurrentUser(me.user);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(casesResponse.testCases) ? casesResponse.testCases : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test cases"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, selectedProjectId, token]);

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

  const normalizeSteps = (steps: Array<{ action: string }>) => steps.filter((step) => String(step.action || "").trim()).map((step) => ({ action: String(step.action || "").trim() }));
  const normalizeAutomationSteps = (steps: any[]) => steps.filter((step) => String(step.action || "").trim()).map((step, index) => ({ order: index + 1, action: String(step.action || "").trim(), targetType: String(step.targetType || "css"), target: String(step.target || ""), value: String(step.value || ""), expected: String(step.expected || ""), timeoutMs: String(step.timeoutMs || "15000") }));

  const saveTestCase = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        ...testCaseForm,
        projectId: testCaseForm.projectId || selectedProjectId,
        steps: normalizeSteps(testCaseForm.steps),
        automation: automationForm.enabled ? { ...automationForm, steps: normalizeAutomationSteps(automationForm.steps) } : { enabled: false, steps: [] },
      };
      if (editingTestCaseId) {
        await apiRequest(`/api/test-cases/${editingTestCaseId}`, token, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Test case updated");
      } else {
        await apiRequest(`/api/test-cases`, token, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Test case created");
      }
      setEditingTestCaseId("");
      setTestCaseForm({ projectId: "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "manual", description: "", expected: "", steps: [{ action: "" }] });
      setAutomationForm({ enabled: false, baseUrl: "", userKey: "", steps: [{ action: "", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15000" }] });
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save test case");
    }
  };

  const cancelTestCaseEdit = () => {
    setEditingTestCaseId("");
    setTestCaseForm({ projectId: "", groupId: "", caseKey: "", title: "", priority: "medium", severity: "major", type: "manual", description: "", expected: "", steps: [{ action: "" }] });
  };

  const startTestCaseEdit = (testCase: RecordAny) => {
    setEditingTestCaseId(getId(testCase));
    setTestCaseForm({
      projectId: getId(testCase.project),
      groupId: getId(testCase.group),
      caseKey: testCase.caseKey || "",
      title: testCase.title || "",
      priority: testCase.priority || "medium",
      severity: testCase.severity || "major",
      type: testCase.type || "manual",
      description: testCase.description || "",
      expected: testCase.expected || "",
      steps: Array.isArray(testCase.steps) && testCase.steps.length ? testCase.steps : [{ action: "" }],
    });
  };

  const deleteTestCase = async (testCaseId: string) => { await apiRequest(`/api/test-cases/${testCaseId}`, token, { method: "DELETE" }); await refreshAll(); };
  const duplicateTestCase = async (testCase: RecordAny) => {
    const payload = { ...testCase, caseKey: `${testCase.caseKey || testCase.key || "CASE"}-COPY`, title: `${testCase.title || testCase.name || "Test case"} copy` };
    delete payload._id;
    delete payload.id;
    delete payload.entityId;
    await apiRequest(`/api/test-cases`, token, { method: "POST", body: JSON.stringify(payload) });
    await refreshAll();
  };
  const deleteTestCases = async (testCaseIds: string[]) => { for (const id of testCaseIds) await deleteTestCase(id); };
  const duplicateTestCases = async (cases: RecordAny[]) => { for (const testCase of cases) await duplicateTestCase(testCase); };
  const addTestCaseStep = () => setTestCaseForm((prev) => ({ ...prev, steps: [...prev.steps, { action: "" }] }));
  const updateTestCaseStep = (index: number, key: string, value: string) => setTestCaseForm((prev) => ({ ...prev, steps: prev.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));
  const removeTestCaseStep = (index: number) => setTestCaseForm((prev) => ({ ...prev, steps: prev.steps.filter((_, stepIndex) => stepIndex !== index) }));
  const moveTestCaseStep = (fromIndex: number, toIndex: number) => setTestCaseForm((prev) => ({ ...prev, steps: prev.steps.slice().map((step, index, list) => { if (index !== fromIndex) return step; const copy = list.slice(); const [item] = copy.splice(fromIndex, 1); copy.splice(toIndex, 0, item); return copy[index]; }).filter(Boolean) }));
  const addAutomationStep = () => setAutomationForm((prev) => ({ ...prev, steps: [...prev.steps, { action: "", targetType: "css", target: "", value: "", expected: "", timeoutMs: "15000" }] }));
  const updateAutomationStep = (index: number, key: string, value: string) => setAutomationForm((prev) => ({ ...prev, steps: prev.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step) }));
  const removeAutomationStep = (index: number) => setAutomationForm((prev) => ({ ...prev, steps: prev.steps.filter((_, stepIndex) => stepIndex !== index) }));
  const moveAutomationStep = (fromIndex: number, toIndex: number) => setAutomationForm((prev) => ({ ...prev, steps: prev.steps.slice().map((step, index, list) => { if (index !== fromIndex) return step; const copy = list.slice(); const [item] = copy.splice(fromIndex, 1); copy.splice(toIndex, 0, item); return copy[index]; }).filter(Boolean) }));
  const downloadTestCaseTemplate = () => { setMessage("Use import template from backend if available"); };
  const importTestCases = async (file: File) => { const formData = new FormData(); formData.append("file", file); await apiRequest(`/api/test-cases/import`, token, { method: "POST", body: formData }); await refreshAll(); };

  const scopedProjects = selectedProjectId
    ? projects.filter((project) => matchesSelectedEntity(project, selectedProjectId))
    : projects;
  const scopedGroups = selectedProjectId
    ? groups.filter((group) => matchesSelectedEntity(group.project, selectedProjectId))
    : groups;
  const matchesSearch = createTextMatcher();
  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Test Cases</div><div className="text-xs text-slate-500">Route-local test case CRUD</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="">All projects</option>{projects.map((project) => <option key={getId(project)} value={getId(project)}>{project.name}</option>)}</select><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading test cases...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="test-cases" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminTestCasesScreen editingTestCaseId={editingTestCaseId} testCaseForm={testCaseForm as any} setTestCaseForm={setTestCaseForm as any} automationForm={automationForm as any} setAutomationForm={setAutomationForm as any} addTestCaseStep={addTestCaseStep} updateTestCaseStep={updateTestCaseStep} removeTestCaseStep={removeTestCaseStep} moveTestCaseStep={moveTestCaseStep} addAutomationStep={addAutomationStep} updateAutomationStep={updateAutomationStep} removeAutomationStep={removeAutomationStep} moveAutomationStep={moveAutomationStep} saveTestCase={saveTestCase} cancelTestCaseEdit={cancelTestCaseEdit} testCases={testCases} matchesSearch={matchesSearch} startTestCaseEdit={startTestCaseEdit} deleteTestCase={deleteTestCase} duplicateTestCase={duplicateTestCase} deleteTestCases={deleteTestCases} duplicateTestCases={duplicateTestCases} scopedProjects={scopedProjects} scopedGroups={scopedGroups} selectedProjectId={selectedProjectId} downloadTestCaseTemplate={downloadTestCaseTemplate} importTestCases={importTestCases} importInputRef={importInputRef} /></AppShell>;
}