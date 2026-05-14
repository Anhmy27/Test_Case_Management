"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest, getId, userName } from "@/lib/api";
import RoleWorkspace from "./RoleWorkspace";

type RecordAny = Record<string, any>;
type TestCaseStepForm = { action: string };

export default function TestCaseManagementApp() {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("tcm_token") || "";
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [message, setMessage] = useState<string>("");

  const [users, setUsers] = useState<RecordAny[]>([]);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    description: "",
  });
  const [editingProjectId, setEditingProjectId] = useState<string>("");
  const [versionForm, setVersionForm] = useState({
    projectId: "",
    name: "",
    releaseDate: "",
  });
  const [groupForm, setGroupForm] = useState({
    projectId: "",
    name: "",
    description: "",
  });
  const [testCaseForm, setTestCaseForm] = useState({
    projectId: "",
    groupId: "",
    caseKey: "",
    title: "",
    description: "",
    expected: "",
    steps: [{ action: "" }] as TestCaseStepForm[],
  });
  const [editingTestCaseId, setEditingTestCaseId] = useState<string>("");
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    projectId: "",
    versionId: "",
    caseIds: [] as string[],
  });
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "" });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assignDraft, setAssignDraft] = useState<{
    ownerId: string;
    assigneeIds: string[];
  }>({
    ownerId: "",
    assigneeIds: [],
  });
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [myItems, setMyItems] = useState<RecordAny[]>([]);
  const lastAlertRef = useRef<string>("");

  const isAdmin = currentUser?.role === "admin";
  const selectedRun = useMemo(
    () => runs.find((run) => String(run._id) === selectedRunId),
    [runs, selectedRunId],
  );
  const canEndRun = useCallback(
    (run?: RecordAny) => {
      if (!run) {
        return false;
      }

      if (isAdmin) {
        return true;
      }

      return (
        String(run.startedBy?._id || run.startedBy) ===
        String(currentUser?._id || "")
      );
    },
    [currentUser?._id, isAdmin],
  );

  const availableTabs = isAdmin
    ? ["overview", "admin", "execution", "dashboard"]
    : ["overview", "execution", "dashboard"];
  const selectedTab = availableTabs.includes(activeTab)
    ? activeTab
    : availableTabs[0];

  const filteredVersions = useMemo(() => {
    if (!selectedProjectId) {
      return versions;
    }
    return versions.filter(
      (version) => getId(version.project) === selectedProjectId,
    );
  }, [versions, selectedProjectId]);

  const filteredCases = useMemo(() => {
    if (!planForm.projectId) {
      return testCases;
    }
    return testCases.filter(
      (testCase) => getId(testCase.project) === planForm.projectId,
    );
  }, [testCases, planForm.projectId]);

  const filteredGroups = useMemo(() => {
    if (!testCaseForm.projectId) {
      return groups;
    }

    return groups.filter(
      (group) => getId(group.project) === testCaseForm.projectId,
    );
  }, [groups, testCaseForm.projectId]);

  const refreshAll = useCallback(
    async (currentToken: string, role?: string, projectId?: string) => {
      const projectQuery = projectId ? `?projectId=${projectId}` : "";
      const projectResp = await apiRequest<{ projects: RecordAny[] }>(
        "/api/projects",
        currentToken,
      );
      const versionResp = await apiRequest<{ versions: RecordAny[] }>(
        `/api/versions${projectQuery}`,
        currentToken,
      );
      const groupResp = await apiRequest<{ groups: RecordAny[] }>(
        `/api/test-case-groups${projectQuery}`,
        currentToken,
      );
      const caseResp = await apiRequest<{ testCases: RecordAny[] }>(
        `/api/test-cases${projectQuery}`,
        currentToken,
      );
      const planResp = await apiRequest<{ testPlans: RecordAny[] }>(
        `/api/test-plans${projectQuery}`,
        currentToken,
      );
      const runResp = await apiRequest<{ testRuns: RecordAny[] }>(
        `/api/test-runs${projectQuery}`,
        currentToken,
      );
      const dashboardResp = await apiRequest<RecordAny>(
        `/api/dashboard${projectQuery}`,
        currentToken,
      );

      setProjects(projectResp.projects || []);
      setVersions(versionResp.versions || []);
      setGroups(groupResp.groups || []);
      setTestCases(caseResp.testCases || []);
      setPlans(planResp.testPlans || []);
      setRuns(runResp.testRuns || []);
      setDashboard(dashboardResp);

      if ((role || currentUser?.role) === "admin") {
        const userResp = await apiRequest<{ users: RecordAny[] }>(
          "/api/users",
          currentToken,
        );
        setUsers(userResp.users || []);
      }
    },
    [currentUser?.role],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<{ user: RecordAny }>("/api/auth/me", token)
      .then(async (resp) => {
        setCurrentUser(resp.user);
        await refreshAll(token, resp.user.role, selectedProjectId);
      })
      .catch(() => {
        window.localStorage.removeItem("tcm_token");
        setToken("");
      });
  }, [token, refreshAll, selectedProjectId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    refreshAll(token, currentUser?.role, selectedProjectId);
  }, [selectedProjectId, token, currentUser?.role, refreshAll]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    setVersionForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
    }));
    setGroupForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
    }));
    setPlanForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
      versionId: "",
    }));
    setTestCaseForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
      groupId: "",
    }));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!message || message === lastAlertRef.current) {
      return;
    }

    lastAlertRef.current = message;
    if (typeof window !== "undefined") {
      window.alert(message);
    }
  }, [message]);

  const selectPlanForAssignment = useCallback(
    (planId: string) => {
      setSelectedPlanId(planId);

      const selectedPlan = plans.find((plan) => String(plan._id) === planId);
      if (!selectedPlan) {
        setAssignDraft({ ownerId: "", assigneeIds: [] });
        return;
      }

      setAssignDraft({
        ownerId: getId(selectedPlan.owner),
        assigneeIds: Array.isArray(selectedPlan.assignees)
          ? selectedPlan.assignees.map((user: any) => getId(user))
          : [],
      });
    },
    [plans],
  );

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const endpoint =
        authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
            };

      const response = await apiRequest<{ token: string; user: RecordAny }>(
        endpoint,
        undefined,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      setToken(response.token);
      setCurrentUser(response.user);
      window.localStorage.setItem("tcm_token", response.token);
      await refreshAll(response.token, response.user.role);
      setMessage(`Xin chao ${response.user.name}. Dang nhap thanh cong.`);
    } catch (error: any) {
      setMessage(error.message || "Auth failed");
    }
  }

  async function withAction(action: () => Promise<void>) {
    try {
      setMessage("");
      await action();
      if (token) {
        await refreshAll(token, currentUser?.role, selectedProjectId);
      }
    } catch (error: any) {
      setMessage(error.message || "Action failed");
    }
  }

  function startProjectEdit(project: RecordAny) {
    setEditingProjectId(String(project._id));
    setProjectForm({
      name: project.name || "",
      code: project.code || "",
      description: project.description || "",
    });
    setActiveTab("projects");
  }

  function cancelProjectEdit() {
    setEditingProjectId("");
    setProjectForm({ name: "", code: "", description: "" });
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      const endpoint = editingProjectId
        ? `/api/projects/${editingProjectId}`
        : "/api/projects";
      const method = editingProjectId ? "PUT" : "POST";

      await apiRequest(endpoint, token, {
        method,
        body: JSON.stringify(projectForm),
      });

      setProjectForm({ name: "", code: "", description: "" });
      setEditingProjectId("");
      setMessage(editingProjectId ? "Da cap nhat project" : "Da tao project");
    });
  }

  async function createVersion(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/versions", token, {
        method: "POST",
        body: JSON.stringify(versionForm),
      });
      setVersionForm({
        projectId: versionForm.projectId,
        name: "",
        releaseDate: "",
      });
      setMessage("Da tao version");
    });
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-case-groups", token, {
        method: "POST",
        body: JSON.stringify(groupForm),
      });
      setGroupForm({
        projectId: groupForm.projectId,
        name: "",
        description: "",
      });
      setMessage("Da tao nhom test case");
    });
  }

  function startTestCaseEdit(testCase: RecordAny) {
    setEditingTestCaseId(String(testCase._id));
    setTestCaseForm({
      projectId: getId(testCase.project),
      groupId: getId(testCase.group),
      caseKey: testCase.caseKey || "",
      title: testCase.title || "",
      description: testCase.description || "",
      expected: testCase.expected || "",
      steps:
        Array.isArray(testCase.steps) && testCase.steps.length > 0
          ? testCase.steps.map((step: RecordAny) => ({
              action: step.action || "",
            }))
          : [{ action: "" }],
    });
    setActiveTab("test-cases");
  }

  function cancelTestCaseEdit() {
    setEditingTestCaseId("");
    setTestCaseForm({
      projectId: "",
      groupId: "",
      caseKey: "",
      title: "",
      description: "",
      expected: "",
      steps: [{ action: "" }],
    });
  }

  async function saveTestCase(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      const steps = testCaseForm.steps
        .filter((step) => step.action.trim())
        .map((step) => ({
          action: step.action,
          expected: testCaseForm.expected,
        }));

      if (steps.length === 0 || !testCaseForm.expected.trim()) {
        throw new Error("Hay nhap it nhat 1 step va expected");
      }

      if (!testCaseForm.groupId) {
        throw new Error("Hay chon nhom test case");
      }

      const endpoint = editingTestCaseId
        ? `/api/test-cases/${editingTestCaseId}`
        : "/api/test-cases";
      const method = editingTestCaseId ? "PUT" : "POST";

      await apiRequest(endpoint, token, {
        method,
        body: JSON.stringify({
          projectId: testCaseForm.projectId,
          groupId: testCaseForm.groupId,
          caseKey: testCaseForm.caseKey,
          title: testCaseForm.title,
          description: testCaseForm.description,
          steps,
        }),
      });
      setTestCaseForm({
        projectId: "",
        groupId: "",
        caseKey: "",
        title: "",
        description: "",
        expected: "",
        steps: [{ action: "" }],
      });
      setEditingTestCaseId("");
      setMessage(
        editingTestCaseId ? "Da cap nhat test case" : "Da tao test case",
      );
    });
  }

  async function deleteProject(projectId: string) {
    if (!window.confirm("Xoa project nay?")) {
      return;
    }

    await withAction(async () => {
      await apiRequest(`/api/projects/${projectId}`, token, {
        method: "DELETE",
      });
      if (editingProjectId === projectId) {
        cancelProjectEdit();
      }
      setMessage("Da xoa project");
    });
  }

  async function deleteTestCase(testCaseId: string) {
    if (!window.confirm("Xoa test case nay?")) {
      return;
    }

    await withAction(async () => {
      await apiRequest(`/api/test-cases/${testCaseId}`, token, {
        method: "DELETE",
      });
      if (editingTestCaseId === testCaseId) {
        cancelTestCaseEdit();
      }
      setMessage("Da xoa test case");
    });
  }

  function addTestCaseStep() {
    setTestCaseForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { action: "" }],
    }));
  }

  function updateTestCaseStep(
    index: number,
    field: keyof TestCaseStepForm,
    value: string,
  ) {
    setTestCaseForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function removeTestCaseStep(index: number) {
    setTestCaseForm((prev) => {
      const nextSteps = prev.steps.filter(
        (_, stepIndex) => stepIndex !== index,
      );
      return {
        ...prev,
        steps: nextSteps.length > 0 ? nextSteps : [{ action: "" }],
      };
    });
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-plans", token, {
        method: "POST",
        body: JSON.stringify(planForm),
      });
      setPlanForm({
        name: "",
        description: "",
        projectId: planForm.projectId,
        versionId: planForm.versionId,
        caseIds: [],
      });
      setMessage("Da tao test plan");
    });
  }

  async function saveAssignments(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlanId) {
      setMessage("Hay chon test plan truoc");
      return;
    }

    await withAction(async () => {
      await apiRequest(`/api/test-plans/${selectedPlanId}/assign`, token, {
        method: "PUT",
        body: JSON.stringify(assignDraft),
      });

      setMessage("Da assign owner va assignees cho test plan");
    });
  }

  async function startRun(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(runForm),
      });
      setRunForm({ testPlanId: "", name: "" });
      setMessage("Da start test run");
    });
  }

  async function endRun(runId: string) {
    await withAction(async () => {
      await apiRequest(`/api/test-runs/${runId}/end`, token, {
        method: "PATCH",
      });
      setMessage("Da end test run");
    });
  }

  async function loadMyItems(runId: string) {
    setSelectedRunId(runId);
    try {
      const response = await apiRequest<{ results: RecordAny[] }>(
        `/api/test-runs/${runId}/my-items`,
        token,
      );
      setMyItems(response.results || []);
      if (!isAdmin && (!response.results || response.results.length === 0)) {
        setMessage("Ban chua duoc assign testcase nao trong run nay");
      }
    } catch (error: any) {
      setMessage(error.message || "Khong tai duoc danh sach case");
    }
  }

  async function updateResult(
    resultId: string,
    status: "pass" | "fail" | "blocked",
    note: string,
  ) {
    if (!selectedRunId) {
      return;
    }

    await withAction(async () => {
      await apiRequest(
        `/api/test-runs/${selectedRunId}/results/${resultId}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ status, note }),
        },
      );
      await loadMyItems(selectedRunId);
      setMessage("Da cap nhat ket qua test");
    });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/users", token, {
        method: "POST",
        body: JSON.stringify(newUserForm),
      });
      setNewUserForm({ name: "", email: "", password: "", role: "employee" });
      setMessage("Admin da tao user moi");
    });
  }

  function logout() {
    window.localStorage.removeItem("tcm_token");
    setToken("");
    setCurrentUser(null);
    setActiveTab("overview");
    setSelectedProjectId("");
    setUsers([]);
    setProjects([]);
    setVersions([]);
    setTestCases([]);
    setPlans([]);
    setRuns([]);
    setDashboard(null);
  }

  const workspace = {
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
    editingTestCaseId,
    startTestCaseEdit,
    cancelTestCaseEdit,
    saveTestCase,
    deleteTestCase,
    addTestCaseStep,
    updateTestCaseStep,
    removeTestCaseStep,
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
    createVersion,
    createGroup,
    createPlan,
    createUser,
    selectedRunId,
    setSelectedRunId,
    myItems,
    loadMyItems,
    selectedRun,
    canEndRun,
    endRun,
    updateResult,
    startRun,
    filteredVersions,
    filteredCases,
    filteredGroups,
    message,
    setMessage,
  };

  function toggleAuthMode() {
    setAuthMode((prev) => (prev === "login" ? "register" : "login"));
  }

  if (!token || !currentUser) {
    return (
      <main className="shell auth-shell">
        <div className="hero">
          <h1>Test Case Management</h1>
          <p>Workspace QA theo role cho admin va employee.</p>
        </div>
        <section className="panel auth-panel">
          <h2>{authMode === "login" ? "Dang nhap" : "Dang ky"}</h2>
          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <div className="field" style={{ marginBottom: "0.5rem" }}>
                <span>Ho ten</span>
                <input
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
            )}
            <div className="field" style={{ marginBottom: "0.5rem" }}>
              <span>Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
            </div>
            <div className="field" style={{ marginBottom: "0.5rem" }}>
              <span>Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm((prev) => ({ ...prev, password: e.target.value }))
                }
                required
                minLength={6}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary">
                {authMode === "login" ? "Dang nhap" : "Dang ky"}
              </button>
              <button
                type="button"
                className="btn btn-alt"
                onClick={toggleAuthMode}
              >
                Chuyen sang {authMode === "login" ? "Dang ky" : "Dang nhap"}
              </button>
            </div>
          </form>
          {message && <p style={{ marginTop: "0.6rem" }}>{message}</p>}
        </section>
      </main>
    );
  }

  return <RoleWorkspace workspace={workspace} />;
}
