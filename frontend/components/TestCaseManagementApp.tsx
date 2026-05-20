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
import { apiRequest, getId } from "@/lib/api";
import * as XLSX from "xlsx";
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
    priority: "medium",
    severity: "major",
    type: "functional",
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
    executionMode: 'manual',
    selectedGroupIds: [] as string[],
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
  const [editingPlanId, setEditingPlanId] = useState<string>("");
  const [editingExecutionMode, setEditingExecutionMode] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const lastTabRef = useRef<string>(activeTab);

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

  const resetWorkspaceDrafts = useCallback(() => {
    setEditingProjectId("");
    setProjectForm({ name: "", code: "", description: "" });
    setVersionForm({ projectId: "", name: "", releaseDate: "" });
    setGroupForm({ projectId: "", name: "", description: "" });
    setEditingTestCaseId("");
    setTestCaseForm({
      projectId: "",
      groupId: "",
      caseKey: "",
      title: "",
      priority: "medium",
      severity: "major",
      type: "functional",
      description: "",
      expected: "",
      steps: [{ action: "" }],
    });
    setPlanForm({
      name: "",
      description: "",
      projectId: "",
      versionId: "",
      executionMode: 'manual',
      selectedGroupIds: [],
      caseIds: [],
    });
    setRunForm({ testPlanId: "", name: "" });
    setNewUserForm({ name: "", email: "", password: "", role: "employee" });
    setSelectedPlanId("");
    setAssignDraft({ ownerId: "", assigneeIds: [] });
    setEditingPlanId("");
    setEditingExecutionMode("");
    setSelectedRunId("");
    setMyItems([]);
  }, []);

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
      try {
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
      } catch (error: any) {
        const messageText = String(error?.message || "");
        const authFailure =
          messageText.includes("User is not available") ||
          messageText.includes("Missing or invalid authorization token") ||
          messageText.includes("Token is expired or invalid") ||
          messageText.includes("Not authenticated");

        if (authFailure) {
          window.localStorage.removeItem("tcm_token");
          setToken("");
          setCurrentUser(null);
          setMessage("Phien dang nhap da het han. Vui long dang nhap lai.");
          return;
        }

        setMessage(error?.message || "Khong tai duoc du lieu");
      }
    },
    [currentUser?.role],
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<{ user: RecordAny }>("/api/auth/me", token)
      .then((resp) => {
        setCurrentUser(resp.user);
        return resp.user.role;
      })
      .then((role) => {
        queueMicrotask(() => {
          void refreshAll(token, role, selectedProjectId);
        });
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

    queueMicrotask(() => {
      void refreshAll(token, currentUser?.role, selectedProjectId);
    });
  }, [selectedProjectId, token, currentUser?.role, refreshAll]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    queueMicrotask(() => {
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
        selectedGroupIds: [],
        caseIds: [],
      }));
      setTestCaseForm((prev) => ({
        ...prev,
        projectId: selectedProjectId,
        groupId: "",
      }));
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    if (lastTabRef.current === activeTab) {
      return;
    }

    lastTabRef.current = activeTab;
    queueMicrotask(() => {
      void refreshAll(token, currentUser?.role, selectedProjectId);
    });
  }, [activeTab, token, currentUser, refreshAll, selectedProjectId]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const toastKind = useMemo(() => {
    if (!message) {
      return "success" as const;
    }

    const lowerMessage = message.toLowerCase();
    const isError =
      lowerMessage.includes("error") ||
      lowerMessage.includes("failed") ||
      lowerMessage.includes("khong") ||
      lowerMessage.includes("chua") ||
      lowerMessage.includes("required") ||
      lowerMessage.includes("invalid") ||
      lowerMessage.includes("not found") ||
      lowerMessage.includes("no ") ||
      lowerMessage.includes("ban chua");

    return isError ? "error" : "success";
  }, [message]);

  const toastNode = message ? (
    <div className={`tcm-toast tcm-toast--${toastKind}`}>
      <span>{message}</span>
      <button
        type="button"
        className="tcm-toast__close"
        onClick={() => setMessage("")}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  ) : null;

  const confirmDialogNode = confirmDialog ? (
    <div className="tcm-confirm-overlay" role="presentation">
      <div className="tcm-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="tcm-confirm-title">
        <h3 id="tcm-confirm-title">{confirmDialog.title}</h3>
        <p>{confirmDialog.description}</p>
        <div className="workspace-inline-actions workspace-inline-actions--right">
          <button
            type="button"
            className="workspace-secondary"
            onClick={() => setConfirmDialog(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="workspace-danger"
            onClick={async () => {
              const activeConfirm = confirmDialog;
              setConfirmDialog(null);
              await activeConfirm.onConfirm();
            }}
          >
            {confirmDialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

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

  const withAction = useCallback(async (action: () => Promise<void>) => {
    try {
      setMessage("");
      await action();
      if (token) {
        await refreshAll(token, currentUser?.role, selectedProjectId);
      }
    } catch (error: any) {
      setMessage(error.message || "Action failed");
    }
  }, [currentUser?.role, refreshAll, selectedProjectId, token]);

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
      priority: testCase.priority || "medium",
      severity: testCase.severity || "major",
      type: testCase.type || "functional",
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
      priority: "medium",
      severity: "major",
      type: "functional",
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
          priority: testCaseForm.priority,
          severity: testCaseForm.severity,
          type: testCaseForm.type,
          description: testCaseForm.description,
          steps,
        }),
      });
      setTestCaseForm({
        projectId: "",
        groupId: "",
        caseKey: "",
        title: "",
        priority: "medium",
        severity: "major",
        type: "functional",
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
    setMessage("Confirming delete project...");
    setConfirmDialog({
      title: "Xoa project nay?",
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa",
      onConfirm: async () => {
        await withAction(async () => {
          await apiRequest(`/api/projects/${projectId}`, token, {
            method: "DELETE",
          });
          if (editingProjectId === projectId) {
            cancelProjectEdit();
          }
          setMessage("Da xoa project");
        });
      },
    });
  }

  async function deleteTestCase(testCaseId: string) {
    setMessage("Confirming delete test case...");
    setConfirmDialog({
      title: "Xoa test case nay?",
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa",
      onConfirm: async () => {
        await withAction(async () => {
          await apiRequest(`/api/test-cases/${testCaseId}`, token, {
            method: "DELETE",
          });
          if (editingTestCaseId === testCaseId) {
            cancelTestCaseEdit();
          }
          setMessage("Da xoa test case");
        });
      },
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
        executionMode: "manual",
        selectedGroupIds: [],
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

  async function updatePlanExecutionMode(planId: string, executionMode: string) {
    await withAction(async () => {
      await apiRequest(`/api/test-plans/${planId}`, token, {
        method: "PUT",
        body: JSON.stringify({ executionMode }),
      });

      setMessage("Da cap nhat execution mode cho test plan");
      setEditingPlanId("");
      setEditingExecutionMode("");
    });
  }

  async function startRun(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      const response = await apiRequest<{ testRun: RecordAny }>("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(runForm),
      });
      if (response.testRun?._id) {
        await loadMyItems(String(response.testRun._id));
        setActiveTab("execution");
      }
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
    } catch (error: any) {
      setMessage(error.message || "Khong tai duoc danh sach case");
    }
  }

  const loadTestCaseDetails = useCallback(
    async ({
      projectId,
      groupId,
      search,
    }: {
      projectId: string;
      groupId?: string;
      search?: string;
    }) => {
      const params = new URLSearchParams();
      params.set("projectId", projectId);

      if (groupId) {
        params.set("groupId", groupId);
      }

      if (search?.trim()) {
        params.set("search", search.trim());
      }

      const response = await apiRequest<{ testCases: RecordAny[] }>(
        `/api/test-cases/detail?${params.toString()}`,
        token,
      );

      return response.testCases || [];
    },
    [token],
  );

  const handleDownloadTestCaseTemplate = useCallback(() => {
    const workbook = XLSX.utils.book_new();
    const headers = [
      "Group Key",
      "Group Name",
      "Case Key",
      "Title",
      "Priority",
      "Severity",
      "Type",
      "Description",
      "Step 1 Action",
      "Step 2 Action",
      "Step 3 Action",
      "Step 4 Action",
      "Step 5 Action",
      "Expected Result",
    ];

    const templateRows = [
      {
        "Group Key": "AUTH",
        "Group Name": "Authentication",
        "Case Key": "LOGIN_001",
        Title: "Login with valid credentials",
        Priority: "high",
        Severity: "major",
        Type: "functional",
        Description: "User can log in with a valid email and password.",
        "Step 1 Action": "Open login page",
        "Step 2 Action": "Enter valid email and password",
        "Step 3 Action": "Click Login",
        "Step 4 Action": "",
        "Step 5 Action": "",
        "Expected Result": "User is redirected to dashboard",
      },
    ];

    const sheet = XLSX.utils.json_to_sheet(templateRows, { header: headers });
    XLSX.utils.book_append_sheet(workbook, sheet, "TestCases");

    const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "test-case-template.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  const handleImportTestCases = useCallback(
    async (file: File) => {
      if (!selectedProjectId) {
        throw new Error("Hay chon project scope truoc khi import");
      }

      await withAction(async () => {
        const formData = new FormData();
        formData.append("projectId", selectedProjectId);
        formData.append("file", file);
        // enable strict validation for priority/severity/type
        formData.append("strict", "true");

        const response = await apiRequest<{
          message: string;
          created: RecordAny[];
          errors: RecordAny[];
          total: number;
        }>("/api/test-cases/import", token, {
          method: "POST",
          body: formData,
        });

        const importedCount = response.created?.length || 0;
        const errorCount = response.errors?.length || 0;
        setMessage(
          `${response.message || `Imported ${importedCount} test cases`}${errorCount ? `, ${errorCount} row(s) failed` : ""}`,
        );

        // if there are errors, generate an Excel file with details for the user to download
        if (Array.isArray(response.errors) && response.errors.length > 0) {
          try {
            const errWb = XLSX.utils.book_new();
            const errRows = response.errors.map((e: any) => ({ Row: e.row, Error: e.error }));
            const errSheet = XLSX.utils.json_to_sheet(errRows, { header: ['Row', 'Error'] });
            XLSX.utils.book_append_sheet(errWb, errSheet, 'ImportErrors');
            const errData = XLSX.write(errWb, { bookType: 'xlsx', type: 'array' });
            const errBlob = new Blob([errData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const errUrl = window.URL.createObjectURL(errBlob);
            const a = document.createElement('a');
            a.href = errUrl;
            a.download = 'import-errors.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(errUrl);
          } catch {
            // ignore error in error reporting
          }
        }
      });
    },
    [selectedProjectId, token, withAction],
  );
  async function updateResult(
    resultId: string,
    status: "pass" | "fail" | "blocked" | "skip",
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
    editingPlanId,
    setEditingPlanId,
    editingExecutionMode,
    setEditingExecutionMode,
    updatePlanExecutionMode,
    createVersion,
    createGroup,
    createPlan,
    createUser,
    selectedRunId,
    setSelectedRunId,
    myItems,
    loadMyItems,
    loadTestCaseDetails,
    downloadTestCaseTemplate: handleDownloadTestCaseTemplate,
    importTestCases: handleImportTestCases,
    selectedRun,
    canEndRun,
    endRun,
    updateResult,
    startRun,
    filteredVersions,
    filteredCases,
    filteredGroups,
    resetWorkspaceDrafts,
    message,
    setMessage,
  };

  function toggleAuthMode() {
    setAuthMode((prev) => (prev === "login" ? "register" : "login"));
  }

  if (!token || !currentUser) {
    return (
      <main className="shell auth-shell">
        {toastNode}
        {confirmDialogNode}
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
        </section>
      </main>
    );
  }

  return (
    <>
      {toastNode}
      {confirmDialogNode}
      <RoleWorkspace workspace={workspace} />
    </>
  );
}









