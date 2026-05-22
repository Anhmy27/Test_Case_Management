"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, getId, userName } from "@/lib/api";
import * as XLSX from "xlsx";
import RoleWorkspace from "./RoleWorkspace";

type RecordAny = Record<string, any>;
type TestCaseStepForm = { action: string };
type AutomationStepForm = {
  action: string;
  targetType: string;
  target: string;
  value: string;
  expected: string;
  timeoutMs: string;
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

function getWorkspaceRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "workspace") {
    return { role: "", tab: "" };
  }

  if (segments[1] === "admin" || segments[1] === "employee") {
    return {
      role: segments[1],
      tab: segments[2] || "",
    };
  }

  return {
    role: "",
    tab: segments[1] || "",
  };
}

function getDefaultTab(role?: string) {
  return role === "admin" ? "dashboard" : "my-test-plans";
}

function getInitialSelectedProjectId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem("tcm_selected_project_id") || "";
}

function resolveWorkspacePath(role?: string, tab?: string) {
  const safeRole = role === "employee" ? "employee" : "admin";
  const safeTab = tab || getDefaultTab(safeRole);
  return `/workspace/${safeRole}/${safeTab}`;
}

export default function TestCaseManagementApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("tcm_token") || "";
  });
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "overview";
    }

    const initialRoute = getWorkspaceRoute(window.location.pathname);
    return initialRoute.tab || "overview";
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
  const [selectedProjectId, setSelectedProjectId] = useState<string>(getInitialSelectedProjectId);

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
  const [editingVersionId, setEditingVersionId] = useState<string>("");
  const [editingGroupId, setEditingGroupId] = useState<string>("");
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
  const [automationForm, setAutomationForm] = useState({
    enabled: false,
    baseUrl: "",
    steps: [
      {
        action: "goto",
        targetType: "url",
        target: "",
        value: "/",
        expected: "",
        timeoutMs: "15000",
      },
    ] as AutomationStepForm[],
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
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "", baseUrl: "" });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
  });
  const [editingUserId, setEditingUserId] = useState<string>("");

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
  const [detailGroupId, setDetailGroupId] = useState<string>("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const lastTabRef = useRef<string>(activeTab);
  const selectedProjectIdRef = useRef<string>(selectedProjectId);
  const router = useRouter();

  const setActiveTab = useCallback(
    (nextTab: string) => {
      console.log('[TCMA] setActiveTab called ->', nextTab);
      setActiveTabState(nextTab);

      if (typeof window !== 'undefined') {
        const nextPath = resolveWorkspacePath(currentUser?.role, nextTab);
        if (window.location.pathname !== nextPath) {
          window.history.pushState({}, "", nextPath);
        }
      }
    },
    [currentUser],
  );

  const isAdmin = currentUser?.role === "admin";
  const currentUserId = String(currentUser?._id || "");
  const dashboardData = dashboard || {};
  const dashboardSummary = dashboardData.summary || {};
  const projectOverview = dashboardData.projectOverview || [];
  const selectedProject = projects.find((project) => project._id === selectedProjectId);
  const scopeLabel = selectedProject ? selectedProject.name : "All projects";
  const isGlobalScope = !selectedProjectId;
  const scopedProjects = isGlobalScope ? projects : selectedProject ? [selectedProject] : [];
  const scopedVersions = isGlobalScope
    ? versions
    : versions.filter((version) => getId(version.project) === selectedProjectId);
  const scopedGroups = isGlobalScope
    ? groups
    : groups.filter((group) => getId(group.project) === selectedProjectId);
  const scopedPlans = isGlobalScope
    ? plans
    : plans.filter((plan) => getId(plan.project) === selectedProjectId);
  const selectedRunPlan = scopedPlans.find((plan) => String(plan._id) === String(runForm.testPlanId));
  const selectedRunPlanIsAutomation = String(selectedRunPlan?.executionMode || "manual") === "automation";
  const scopedRuns = isGlobalScope
    ? runs
    : runs.filter((run) => getId(run.testPlan?.project) === selectedProjectId);
  const myScopedRuns = scopedRuns.filter(
    (run) => String(run.startedBy?._id || run.startedBy || "") === currentUserId,
  );
  const adminRuns = isAdmin ? runs : scopedRuns;
  const navItems = isAdmin
    ? isGlobalScope
      ? adminNav.filter((item) => ["dashboard", "projects", "users"].includes(item.key))
      : adminNav.filter((item) => item.key !== "projects")
    : employeeNav;
  const visibleTab = navItems.some((item) => item.key === activeTab) ? activeTab : navItems[0].key;
  const activeTabLabel = navItems.find((item) => item.key === visibleTab)?.label || "Workspace";
  const searchTerm = "";
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const totalProjects = projects.length;
  const totalPlans = plans.length;
  const totalCases = testCases.length;
  const totalUsers = users.length;
  const runningRuns = runs.filter((run) => run.status === "running");
  const runningRunsCount = runningRuns.length;

  const matchesSearch = (...values: Array<string | number | undefined | null>) =>
    values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const planProjectGroups = planForm.projectId
    ? groups.filter((group) => getId(group.project) === planForm.projectId)
    : [];
  const planProjectCases = planForm.projectId
    ? testCases.filter((testCase) => getId(testCase.project) === planForm.projectId)
    : [];
  const selectedPlanGroupIds = new Set(planForm.selectedGroupIds || []);
  const selectedPlanCaseIds = new Set(planForm.caseIds || []);
  const selectedPlanGroups = planProjectGroups.filter((group) =>
    selectedPlanGroupIds.has(String(group._id)),
  );
  const selectedPlanCasesByGroup = selectedPlanGroups.map((group) => {
    const groupId = String(group._id);
    return {
      group,
      cases: planProjectCases.filter((testCase) => String(getId(testCase.group)) === groupId),
    };
  });

  function togglePlanGroup(groupId: string) {
    setPlanForm((prev) => {
      const nextGroupIds = prev.selectedGroupIds.includes(groupId)
        ? prev.selectedGroupIds.filter((id) => id !== groupId)
        : [...prev.selectedGroupIds, groupId];
      const nextGroupSet = new Set(nextGroupIds);
      const nextCaseIds = prev.caseIds.filter((caseId) => {
        const linkedCase = testCases.find((testCase) => String(testCase._id) === caseId);

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
    setPlanForm((prev) => {
      const nextGroupIds = prev.selectedGroupIds.includes(groupId)
        ? prev.selectedGroupIds
        : [...prev.selectedGroupIds, groupId];
      const nextCaseIds = prev.caseIds.includes(caseId)
        ? prev.caseIds.filter((id) => id !== caseId)
        : [...prev.caseIds, caseId];

      return {
        ...prev,
        selectedGroupIds: nextGroupIds,
        caseIds: nextCaseIds,
      };
    });
  }

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
    setEditingVersionId("");
    setEditingGroupId("");
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
    setAutomationForm({
      enabled: false,
      baseUrl: "",
      steps: [
        {
          action: "goto",
          targetType: "url",
          target: "",
          value: "/",
          expected: "",
          timeoutMs: "15000",
        },
      ],
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
    setRunForm({ testPlanId: "", name: "", baseUrl: "" });
    setNewUserForm({ name: "", email: "", password: "", role: "employee" });
    setEditingUserId("");
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

  const isRefreshingRef = useRef(false);
  const pendingRefreshNeededRef = useRef(false);
  const refreshControllerRef = useRef<AbortController | null>(null);
  const tokenRef = useRef<string>(token);
  const currentUserRef = useRef<RecordAny | null>(currentUser);

  // use a ref-backed implementation so the function identity stays stable
  const refreshAllRef = useRef<((currentToken: string, role?: string, projectId?: string) => Promise<void>) | null>(null);

  useEffect(() => {
    refreshAllRef.current = async (currentToken: string, role?: string, projectId?: string) => {
      if (isRefreshingRef.current) {
        pendingRefreshNeededRef.current = true;
        return;
      }

      // cancel any previous controller and create a new one for this run
      try {
        if (refreshControllerRef.current) {
          try {
            refreshControllerRef.current.abort();
          } catch {}
        }
      } catch {}

      const controller = new AbortController();
      refreshControllerRef.current = controller;
      try {
        // expose to window so navigation handler can abort it if needed
        if (typeof window !== 'undefined') (window as any).__tcm_refreshController = controller;
      } catch {}

      isRefreshingRef.current = true;

      try {
        const projectQuery = projectId ? `?projectId=${projectId}` : "";
        const opts = { signal: controller.signal } as RequestInit;

        // helper to run tasks with limited concurrency
        const runWithConcurrency = async <T,>(tasks: Array<() => Promise<T>>, limit = 2) => {
          const results: T[] = [];
          let i = 0;

          const workers: Promise<void>[] = [];

          const runOne = async () => {
            while (true) {
              const idx = i++;
              if (idx >= tasks.length) return;
              const res = await tasks[idx]();
              results[idx] = res;
            }
          };

          for (let w = 0; w < Math.min(limit, tasks.length); w++) {
            workers.push(runOne());
          }

          await Promise.all(workers);
          return results;
        };

        const projectResp = await apiRequest<{ projects: RecordAny[] }>(
          "/api/projects",
          currentToken,
          opts,
        );

        // group remaining heavier endpoints and run with limited concurrency
        const taskFns: Array<() => Promise<any>> = [
          () => apiRequest<{ versions: RecordAny[] }>(`/api/versions${projectQuery}`, currentToken, opts),
          () => apiRequest<{ groups: RecordAny[] }>(`/api/test-case-groups${projectQuery}`, currentToken, opts),
          () => apiRequest<{ testCases: RecordAny[] }>(`/api/test-cases${projectQuery}`, currentToken, opts),
          () => apiRequest<{ testPlans: RecordAny[] }>(`/api/test-plans${projectQuery}`, currentToken, opts),
          () => apiRequest<{ testRuns: RecordAny[] }>(`/api/test-runs${projectQuery}`, currentToken, opts),
          () => apiRequest<RecordAny>(`/api/dashboard${projectQuery}`, currentToken, opts),
        ];

        const [versionResp, groupResp, caseResp, planResp, runResp, dashboardResp] = await runWithConcurrency(taskFns, 2);

        setProjects(projectResp.projects || []);
        setVersions((versionResp && versionResp.versions) || []);
        setGroups((groupResp && groupResp.groups) || []);
        setTestCases((caseResp && caseResp.testCases) || []);
        setPlans((planResp && planResp.testPlans) || []);
        setRuns((runResp && runResp.testRuns) || []);
        setDashboard(dashboardResp || null);

        if ((role || currentUser?.role) === "admin") {
          const userResp = await apiRequest<{ users: RecordAny[] }>(
            "/api/users",
            currentToken,
            opts,
          );
          setUsers(userResp.users || []);
        }
      } catch (error: any) {
        // ignore abort errors as they're expected when cancelling
        const isAbort = error && (error.name === 'AbortError' || String(error).toLowerCase().includes('abort'));
        if (!isAbort) {
          setMessage(error?.message || "Khong tai duoc du lieu");
        }
      } finally {
        isRefreshingRef.current = false;
        // clear controller if it's the one we created
        if (refreshControllerRef.current === controller) {
          refreshControllerRef.current = null;
          try {
            if (typeof window !== 'undefined') (window as any).__tcm_refreshController = null;
          } catch {}
        }

        if (pendingRefreshNeededRef.current) {
          pendingRefreshNeededRef.current = false;
          queueMicrotask(() => {
            if (refreshAllRef.current) {
              void refreshAllRef.current(tokenRef.current, currentUserRef.current?.role, selectedProjectIdRef.current);
            }
          });
        }
      }
    };
  }, [currentUser]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const refreshAll = useCallback((currentToken: string, role?: string, projectId?: string) => {
    if (!refreshAllRef.current) return Promise.resolve();
    try {
      if (typeof window !== 'undefined' && (window as any).__tcm_navigationPending) {
        // navigation is in progress — mark that we need a refresh afterwards and skip now
        pendingRefreshNeededRef.current = true;
        return Promise.resolve();
      }
    } catch {}

    return refreshAllRef.current(currentToken, role, projectId);
  }, []);

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
        console.log('[TCMA] auth.me resolved, scheduling refreshAll', { role, projectId: selectedProjectIdRef.current });
        // only perform the initial auth refresh once per token across potential dev double-mounts
        try {
          if (typeof window !== 'undefined' && (window as any).__tcm_initialRefreshToken !== token) {
            (window as any).__tcm_initialRefreshToken = token;
            queueMicrotask(() => {
              void refreshAll(token, role, selectedProjectIdRef.current);
            });
          } else {
            console.log('[TCMA] initial refresh already done, skipping duplicate');
          }
        } catch {
          queueMicrotask(() => {
            void refreshAll(token, role, selectedProjectIdRef.current);
          });
        }
      })
      .catch(() => {
        window.localStorage.removeItem("tcm_token");
        setToken("");
      });
  }, [token, refreshAll]);

  useEffect(() => {
    const handlePopState = () => {
      const { tab: tabFromPath } = getWorkspaceRoute(window.location.pathname);
      if (tabFromPath) {
        setActiveTabState(tabFromPath);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedProjectId) {
      window.localStorage.setItem("tcm_selected_project_id", selectedProjectId);
    } else {
      window.localStorage.removeItem("tcm_selected_project_id");
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    if (lastTabRef.current === activeTab) {
      return;
    }

    lastTabRef.current = activeTab;
    try {
      void refreshAll(token, currentUser?.role, selectedProjectIdRef.current);
    } catch {
      void refreshAll(token, currentUser?.role, selectedProjectIdRef.current);
    }
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
  }, [currentUser, refreshAll, selectedProjectId, token]);

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
      const endpoint = editingVersionId ? `/api/versions/${editingVersionId}` : "/api/versions";
      const method = editingVersionId ? "PUT" : "POST";

      await apiRequest(endpoint, token, {
        method,
        body: JSON.stringify(versionForm),
      });
      setVersionForm({
        projectId: versionForm.projectId,
        name: "",
        releaseDate: "",
      });
      setEditingVersionId("");
      setMessage(editingVersionId ? "Da cap nhat version" : "Da tao version");
    });
  }

  function startVersionEdit(version: RecordAny) {
    setEditingVersionId(String(version._id));
    setVersionForm({
      projectId: getId(version.project),
      name: version.name || "",
      releaseDate: version.releaseDate ? String(version.releaseDate).slice(0, 10) : "",
    });
    setActiveTab("versions");
  }

  function cancelVersionEdit() {
    setEditingVersionId("");
    setVersionForm({ projectId: "", name: "", releaseDate: "" });
  }

  async function deleteVersion(versionId: string) {
    setMessage("Confirming delete version...");
    setConfirmDialog({
      title: "Xoa version nay?",
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa",
      onConfirm: async () => {
        await withAction(async () => {
          await apiRequest(`/api/versions/${versionId}`, token, {
            method: "DELETE",
          });
          if (editingVersionId === versionId) {
            cancelVersionEdit();
          }
          setMessage("Da xoa version");
        });
      },
    });
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      const endpoint = editingGroupId ? `/api/test-case-groups/${editingGroupId}` : "/api/test-case-groups";
      const method = editingGroupId ? "PUT" : "POST";

      await apiRequest(endpoint, token, {
        method,
        body: JSON.stringify(groupForm),
      });
      setGroupForm({
        projectId: groupForm.projectId,
        name: "",
        description: "",
      });
      setEditingGroupId("");
      setMessage(editingGroupId ? "Da cap nhat nhom test case" : "Da tao nhom test case");
    });
  }

  function startGroupEdit(group: RecordAny) {
    setEditingGroupId(String(group._id));
    setGroupForm({
      projectId: getId(group.project),
      name: group.name || "",
      description: group.description || "",
    });
    setActiveTab("groups");
  }

  function cancelGroupEdit() {
    setEditingGroupId("");
    setGroupForm({ projectId: "", name: "", description: "" });
  }

  async function deleteGroup(groupId: string) {
    setMessage("Confirming delete group...");
    setConfirmDialog({
      title: "Xoa nhom test case nay?",
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa",
      onConfirm: async () => {
        await withAction(async () => {
          await apiRequest(`/api/test-case-groups/${groupId}`, token, {
            method: "DELETE",
          });
          if (editingGroupId === groupId) {
            cancelGroupEdit();
          }
          setMessage("Da xoa nhom test case");
        });
      },
    });
  }

  function startTestCaseEdit(testCase: RecordAny) {
    setEditingTestCaseId(String(testCase._id));
    const automationSteps = Array.isArray(testCase.automation?.steps)
      ? testCase.automation.steps.map((step: RecordAny) => ({
          action: step.action || "goto",
          targetType: step.targetType || "css",
          target: step.target || "",
          value: step.value || "",
          expected: step.expected || "",
          timeoutMs: String(step.timeoutMs || 15000),
        }))
      : [
          {
            action: "goto",
            targetType: "url",
            target: "",
            value: "/",
            expected: "",
            timeoutMs: "15000",
          },
        ];

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
    setAutomationForm({
      enabled: Boolean(testCase.automation?.enabled),
      baseUrl: testCase.automation?.baseUrl || "",
      steps: automationSteps,
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
    setAutomationForm({
      enabled: false,
      baseUrl: "",
      steps: [
        {
          action: "goto",
          targetType: "url",
          target: "",
          value: "/",
          expected: "",
          timeoutMs: "15000",
        },
      ],
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

      const automationSteps = automationForm.steps
        .filter((step) => step.action.trim())
        .map((step, index) => ({
          order: index + 1,
          action: step.action,
          targetType: step.targetType,
          target: step.target,
          value: step.value,
          expected: step.expected,
          timeoutMs: Number(step.timeoutMs || 15000),
        }));

      if (automationForm.enabled && automationSteps.length === 0) {
        throw new Error("Hay nhap it nhat 1 automation step");
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
          automation: {
            enabled: automationForm.enabled,
            baseUrl: automationForm.baseUrl,
            runner: "playwright",
            steps: automationSteps,
          },
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
      setAutomationForm({
        enabled: false,
        baseUrl: "",
        steps: [
          {
            action: "goto",
            targetType: "url",
            target: "",
            value: "/",
            expected: "",
            timeoutMs: "15000",
          },
        ],
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

  function addAutomationStep() {
    setAutomationForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          action: "click",
          targetType: "css",
          target: "",
          value: "",
          expected: "",
          timeoutMs: "15000",
        },
      ],
    }));
  }

  function updateAutomationStep(
    index: number,
    field: keyof AutomationStepForm,
    value: string,
  ) {
    setAutomationForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step,
      ),
    }));
  }

  function removeAutomationStep(index: number) {
    setAutomationForm((prev) => {
      const nextSteps = prev.steps.filter((_, stepIndex) => stepIndex !== index);
      return {
        ...prev,
        steps: nextSteps.length > 0
          ? nextSteps
          : [
              {
                action: "goto",
                targetType: "url",
                target: "",
                value: "/",
                expected: "",
                timeoutMs: "15000",
              },
            ],
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
      const response = await apiRequest<{
        testRun: RecordAny;
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(runForm),
      });
      if (response.testRun?._id) {
        await loadMyItems(String(response.testRun._id));
        setActiveTab("execution");
      }
      setRunForm({ testPlanId: "", name: "", baseUrl: "" });
      if (response.automationSummary) {
        setMessage(
          `Da start automation run: pass ${response.automationSummary.pass || 0}, fail ${response.automationSummary.fail || 0}, blocked ${response.automationSummary.blocked || 0}`,
        );
      } else {
        setMessage("Da start test run");
      }
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

  useEffect(() => {
    if (!isAdmin || visibleTab !== "test-cases-detail") {
      return;
    }

    if (!selectedProjectId) {
      queueMicrotask(() => {
        setDetailRows([]);
        setDetailLoading(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setDetailLoading(true);

      void loadTestCaseDetails({
        projectId: selectedProjectId,
        groupId: detailGroupId,
        search: undefined,
      })
        .then((rows) => {
          if (!cancelled) {
            setDetailRows(rows || []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDetailRows([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setDetailLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [detailGroupId, isAdmin, loadTestCaseDetails, selectedProjectId, visibleTab]);

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
      const payload = {
        name: newUserForm.name,
        email: newUserForm.email,
        role: newUserForm.role,
        ...(newUserForm.password.trim() ? { password: newUserForm.password } : {}),
      };

      if (!editingUserId && !newUserForm.password.trim()) {
        throw new Error("Hay nhap password");
      }

      const endpoint = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";

      await apiRequest(endpoint, token, {
        method,
        body: JSON.stringify(payload),
      });
      setNewUserForm({ name: "", email: "", password: "", role: "employee" });
      setEditingUserId("");
      setMessage(editingUserId ? "Admin da cap nhat user" : "Admin da tao user moi");
    });
  }

  function startUserEdit(user: RecordAny) {
    setEditingUserId(String(user._id));
    setNewUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role === "admin" ? "admin" : "employee",
    });
    setActiveTab("users");
  }

  function cancelUserEdit() {
    setEditingUserId("");
    setNewUserForm({ name: "", email: "", password: "", role: "employee" });
  }

  async function deleteUser(userId: string) {
    setMessage("Confirming delete user...");
    setConfirmDialog({
      title: "Xoa user nay?",
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa",
      onConfirm: async () => {
        await withAction(async () => {
          await apiRequest(`/api/users/${userId}`, token, {
            method: "DELETE",
          });

          if (editingUserId === userId) {
            cancelUserEdit();
          }

          setMessage("Da xoa user");
        });
      },
    });
  }

  function logout() {
    window.localStorage.removeItem("tcm_token");
    window.localStorage.removeItem("tcm_selected_project_id");
    if (typeof window !== "undefined") {
      (window as any).__tcm_initialRefreshToken = "";
      (window as any).__tcm_initialRefreshDone = false;
    }
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
    router.replace("/");
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
    editingVersionId,
    startVersionEdit,
    cancelVersionEdit,
    deleteVersion,
    groupForm,
    setGroupForm,
    editingGroupId,
    startGroupEdit,
    cancelGroupEdit,
    deleteGroup,
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
    editingUserId,
    startUserEdit,
    cancelUserEdit,
    deleteUser,
    selectedRunId,
    setSelectedRunId,
    detailGroupId,
    setDetailGroupId,
    detailRows,
    detailLoading,
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
    dashboardData,
    dashboardSummary,
    projectOverview,
    selectedProject,
    scopeLabel,
    isGlobalScope,
    scopedProjects,
    scopedVersions,
    scopedGroups,
    scopedPlans,
    selectedRunPlan,
    selectedRunPlanIsAutomation,
    scopedRuns,
    myScopedRuns,
    adminRuns,
    navItems,
    visibleTab,
    activeTabLabel,
    normalizedSearch,
    totalProjects,
    totalPlans,
    totalCases,
    totalUsers,
    runningRuns,
    runningRunsCount,
    matchesSearch,
    userName,
    getId,
    planProjectGroups,
    planProjectCases,
    selectedPlanGroupIds,
    selectedPlanCaseIds,
    selectedPlanGroups,
    selectedPlanCasesByGroup,
    togglePlanGroup,
    togglePlanCase,
    currentUserId,
    filteredVersions,
    filteredCases,
    filteredGroups,
    resetWorkspaceDrafts,
    message,
    setMessage,
  };

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!token) {
      try {
        router.replace("/");
      } catch {}
    }
  }, [token, router]);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {toastNode}
      {confirmDialogNode}
      <RoleWorkspace workspace={workspace} />
    </>
  );
}









