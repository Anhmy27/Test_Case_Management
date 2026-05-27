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
  { key: "issue-types", label: "Issue Types" },
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

function getProjectJiraProductKey(project?: RecordAny | null) {
  return String(
    project?.jiraProjectKey ||
      project?.jiraProductKey ||
      project?.Jiraproduckeys ||
      project?.JiraProductKey ||
      project?.jiraProductKeys ||
      project?.code ||
      project?.Code ||
      "",
  ).trim();
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
  const [issueTypes, setIssueTypes] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(getInitialSelectedProjectId);

  const [projectForm, setProjectForm] = useState({
    name: "",
    code: "",
    pid: "",
    jiraProductKey: "",
    description: "",
  });
  const [assigneeQuery, setAssigneeQuery] = useState<string>("");
  const [assigneeOptions, setAssigneeOptions] = useState<RecordAny[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState<boolean>(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<boolean>(false);
  const [editingProjectId, setEditingProjectId] = useState<string>("");
  const [versionForm, setVersionForm] = useState({
    projectId: "",
    name: "",
    idjira: "",
    releaseDate: "",
  });
  const [issueTypeForm, setIssueTypeForm] = useState({
    name: "",
    idjira: "",
  });
  const [groupForm, setGroupForm] = useState({
    projectId: "",
    name: "",
    description: "",
  });
  const [editingVersionId, setEditingVersionId] = useState<string>("");
  const [editingIssueTypeId, setEditingIssueTypeId] = useState<string>("");
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
    userKey: "",
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
  const [jiraBugDialog, setJiraBugDialog] = useState<{
    projectId: string;
    projectName: string;
    runId: string;
    resultId: string;
    caseKey: string;
    caseTitle: string;
    issueType: string;
    summary: string;
    description: string;
    priority: string;
    assignee: string;
    originalEstimate: string;
    versions: string[];
    labels: string;
    submitting: boolean;
    error: string;
  } | null>(null);
  const getAssigneeValue = useCallback((assignee: RecordAny) => {
    return String(assignee.name || assignee.key || assignee.accountId || '');
  }, []);
  const selectedAssigneeLabel = useMemo(() => {
    if (!jiraBugDialog?.assignee) {
      return '';
    }

    const selectedAssignee = assigneeOptions.find((assignee) => getAssigneeValue(assignee) === jiraBugDialog.assignee);
    return String(
      selectedAssignee?.displayName ||
        selectedAssignee?.name ||
        selectedAssignee?.key ||
        jiraBugDialog.assignee ||
        '',
    );
  }, [assigneeOptions, getAssigneeValue, jiraBugDialog?.assignee]);

  const selectedAssigneeDetail = useMemo(() => {
    if (!jiraBugDialog?.assignee) return null;
    return (
      assigneeOptions.find((assignee) => getAssigneeValue(assignee) === jiraBugDialog.assignee) || null
    );
  }, [assigneeOptions, getAssigneeValue, jiraBugDialog?.assignee]);
  const jiraIssueTypeOptions = useMemo(() => {
    return issueTypes;
  }, [issueTypes]);
  const lastTabRef = useRef<string>(activeTab);
  const selectedProjectIdRef = useRef<string>(selectedProjectId);
  const previousSelectedProjectIdRef = useRef<string | null>(null);
  const router = useRouter();

  const setActiveTab = useCallback(
    (nextTab: string) => {
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
    : runs.filter((run) => getId(run.testPlan?.project ?? run.project) === selectedProjectId);
  const myScopedRuns = scopedRuns.filter(
    (run) => String(run.startedBy?._id || run.startedBy || "") === currentUserId,
  );
  const adminRuns = isAdmin ? runs : scopedRuns;
  const navItems = (() => {
    if (!isAdmin) return employeeNav;

    const allowedForGlobal = [
      "dashboard",
      "projects",
      "issue-types",
      "execution",
      "users",
    ];

    const allowedForProject = [
      "dashboard",
      "groups",
      "test-cases",
      "test-cases-detail",
      "versions",
      "test-plans",
      "test-runs",
      "execution",
      "users",
    ];

    const allowed = isGlobalScope ? allowedForGlobal : allowedForProject;
    return adminNav.filter((item) => allowed.includes(item.key));
  })();
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
    setProjectForm({ name: "", code: "", pid: "", jiraProductKey: "", description: "" });
    setVersionForm({ projectId: "", name: "", idjira: "", releaseDate: "" });
    setIssueTypeForm({ name: "", idjira: "" });
    setGroupForm({ projectId: "", name: "", description: "" });
    setEditingVersionId("");
    setEditingIssueTypeId("");
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
      userKey: "",
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
          () => apiRequest<{ issueTypes: RecordAny[] }>(`/api/issue-types`, currentToken, opts),
          () => apiRequest<RecordAny>(`/api/dashboard${projectQuery}`, currentToken, opts),
        ];

        const [versionResp, groupResp, caseResp, planResp, runResp, issueTypeResp, dashboardResp] = await runWithConcurrency(taskFns, 2);

        setProjects(projectResp.projects || []);
        setVersions((versionResp && versionResp.versions) || []);
        setGroups((groupResp && groupResp.groups) || []);
        setTestCases((caseResp && caseResp.testCases) || []);
        setPlans((planResp && planResp.testPlans) || []);
        setRuns((runResp && runResp.testRuns) || []);
        setIssueTypes((issueTypeResp && issueTypeResp.issueTypes) || []);
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
    // fetch issue types when project scope or token changes (for dropdowns)
    if (!token) return;

    let cancelled = false;
    void apiRequest<{ issueTypes: RecordAny[] }>(`/api/issue-types`, token)
      .then((resp) => {
        if (cancelled) return;
        setIssueTypes(Array.isArray(resp.issueTypes) ? resp.issueTypes : []);
      })
      .catch(() => {
        if (cancelled) return;
        setIssueTypes([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token, selectedProjectId]);

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
        // only perform the initial auth refresh once per token across potential dev double-mounts
        try {
          if (typeof window !== 'undefined' && (window as any).__tcm_initialRefreshToken !== token) {
            (window as any).__tcm_initialRefreshToken = token;
            queueMicrotask(() => {
              void refreshAll(token, role, selectedProjectIdRef.current);
            });
          } else {
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
      setIssueTypeForm((prev) => ({
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
    if (previousSelectedProjectIdRef.current === null) {
      previousSelectedProjectIdRef.current = selectedProjectId;
      return;
    }

    if (previousSelectedProjectIdRef.current === selectedProjectId) {
      return;
    }

    previousSelectedProjectIdRef.current = selectedProjectId;

    if (!token || !currentUser) {
      return;
    }

    void refreshAll(token, currentUser?.role, selectedProjectId);
  }, [currentUser, refreshAll, selectedProjectId, token]);

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
    const isError = [
      "error",
      "failed",
      "duplicate",
      "already exists",
      "conflict",
      "not found",
      "invalid",
      "required",
      "forbidden",
      "unauthorized",
      "denied",
      "cannot",
      "can't",
      "khong",
      "không",
      "chua",
      "chưa",
      "ton tai",
      "tồn tại",
      "already exists",
    ].some((needle) => lowerMessage.includes(needle));

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
      pid: project.pid || "",
      jiraProductKey: getProjectJiraProductKey(project),
      description: project.description || "",
    });
    setActiveTab("projects");
  }

  function cancelProjectEdit() {
    setEditingProjectId("");
    setProjectForm({ name: "", code: "", pid: "", jiraProductKey: "", description: "" });
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

      setProjectForm({ name: "", code: "", pid: "", jiraProductKey: "", description: "" });
      setEditingProjectId("");
      setMessage(editingProjectId ? "Da cap nhat project" : "Da tao project");
    });
  }

  const buildJiraBugDescription = useCallback((selectedRunValue: RecordAny, selectedItemValue: RecordAny) => {
    const testCase = selectedItemValue?.testCase || {};
    const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
    const uniqueExpected = Array.from(
      new Set(
        steps
          .map((step: RecordAny) => String(step.expected || "").trim())
          .filter(Boolean),
      ),
    );
    const stepLines = steps.flatMap((step: RecordAny, index: number) => {
      const action = String(step.action || "").trim();
      const lines = [`${index + 1}. ${action || "Step"}`];
      return lines;
    });

    return [
      `Run: ${selectedRunValue?.name || ""}`,
      `Test case: ${testCase.caseKey || "TC"} - ${testCase.title || "Untitled"}`,
      "",
      "Steps to reproduce:",
      ...(stepLines.length > 0 ? stepLines : ["1. <no manual steps captured>"]),
      "",
      `Expected result: ${uniqueExpected.length > 0 ? uniqueExpected.join(" | ") : testCase.expected || "N/A"}`,
      "",
      `Actual result: ${selectedItemValue?.note || ""}`,
    ].join("\n");
  }, []);

  const mapPriorityToJira = useCallback((priority?: string) => {
    switch (String(priority || "").toLowerCase()) {
      case "critical":
      case "highest":
        return "1";
      case "high":
        return "2";
      case "medium":
        return "3";
      case "low":
        return "4";
      case "lowest":
        return "5";
      default:
        return "3";
    }
  }, []);

  const openJiraBugDialog = useCallback(async (run: RecordAny, result: RecordAny) => {
    const projectId = getId(run?.project);
    const project = projects.find((item) => String(item._id) === String(projectId));

    if (!project || !projectId) {
      setMessage("Run project is missing Jira configuration");
      return;
    }

    // Resolve idjira from the local versions list when possible
    let runVersionIdJira = "";

    // If run.version is an object or id, try to find matching loaded version
    const runVersionRef = run?.version && (run.version._id || run.version);
    if (runVersionRef) {
      const matched = versions.find((v) => String(v._id) === String(runVersionRef));
      if (matched) runVersionIdJira = String(matched.idjira || '').trim();
    }

    // Fall back to other available fields
    if (!runVersionIdJira) {
      runVersionIdJira = String(
        run?.version?.idjira || run?.testPlan?.version?.idjira || run?.testPlanVersion?.idjira || run?.version?.name || ''
      ).trim();
    }

    setJiraBugDialog({
      projectId,
      projectName: project.name || "",
      runId: String(run?._id || ""),
      resultId: String(result?._id || ""),
      caseKey: result?.testCase?.caseKey || "TC",
      caseTitle: result?.testCase?.title || "Untitled",
      issueType: "",
      summary: `[${result?.testCase?.caseKey || "TC"}] ${result?.testCase?.title || "Untitled"}`,
      description: buildJiraBugDescription(run, result),
      priority: mapPriorityToJira(result?.testCase?.priority),
      assignee: "",
      originalEstimate: "",
      versions: runVersionIdJira ? [runVersionIdJira] : [],
      labels: "",
      submitting: false,
      error: "",
    });
  }, [buildJiraBugDescription, mapPriorityToJira, projects, versions]);

  const closeJiraBugDialog = useCallback(() => {
    setJiraBugDialog(null);
  }, []);

  const updateJiraBugDialog = useCallback((patch: Partial<NonNullable<typeof jiraBugDialog>>) => {
    setJiraBugDialog((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  useEffect(() => {
    if (!jiraBugDialog?.projectId || !assigneeDropdownOpen) return;

    const project = projects.find((p) => String(p._id) === String(jiraBugDialog.projectId));
    const projectKey = getProjectJiraProductKey(project);

    if (!projectKey) {
      queueMicrotask(() => {
        setAssigneeOptions([]);
        setAssigneeLoading(false);
      });
      return;
    }

    const q = encodeURIComponent(assigneeQuery || '');
    const url = `/api/jira/assignable-users?projectKeys=${encodeURIComponent(projectKey)}&maxResults=100&username=${q}`;

    let cancelled = false;
    void apiRequest<{ users: RecordAny[] }>(url, token)
      .then((resp) => {
        if (cancelled) return;
        setAssigneeOptions(Array.isArray(resp.users) ? resp.users : []);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setAssigneeOptions([]);
        setMessage(err?.message || 'Unable to fetch Jira users');
      })
      .finally(() => {
        if (!cancelled) setAssigneeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assigneeQuery, assigneeDropdownOpen, jiraBugDialog?.projectId, projects, token]);

  const submitJiraBug = useCallback(async () => {
    if (!jiraBugDialog) {
      return;
    }

    updateJiraBugDialog({ submitting: true, error: "" });

    try {
      await apiRequest("/api/jira/log-bug", token, {
        method: "POST",
        body: JSON.stringify({
          projectId: jiraBugDialog.projectId,
          runId: jiraBugDialog.runId,
          resultId: jiraBugDialog.resultId,
          summary: jiraBugDialog.summary,
          description: jiraBugDialog.description,
          issueType: jiraBugDialog.issueType,
          priority: jiraBugDialog.priority,
          assignee: jiraBugDialog.assignee,
          timetracking_originalestimate: jiraBugDialog.originalEstimate,
          versions: jiraBugDialog.versions,
          labels: jiraBugDialog.labels,
        }),
      });

      setMessage("Da log bug len Jira");
      closeJiraBugDialog();
    } catch (error: any) {
      updateJiraBugDialog({ submitting: false, error: error.message || "Unable to log Jira bug" });
    }
  }, [closeJiraBugDialog, jiraBugDialog, token, updateJiraBugDialog]);

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
        idjira: "",
        releaseDate: "",
      });
      setEditingVersionId("");
      setMessage(editingVersionId ? "Da cap nhat version" : "Da tao version");
    });
  }
    async function createIssueType(event: FormEvent) {
      event.preventDefault();
      await withAction(async () => {
        const endpoint = editingIssueTypeId ? `/api/issue-types/${editingIssueTypeId}` : "/api/issue-types";
        const method = editingIssueTypeId ? "PUT" : "POST";

        await apiRequest(endpoint, token, {
          method,
          body: JSON.stringify({ name: issueTypeForm.name, idjira: issueTypeForm.idjira }),
        });

        setIssueTypeForm({ name: "", idjira: "" });
        setEditingIssueTypeId("");
        setMessage(editingIssueTypeId ? "Da cap nhat Issue type" : "Da tao Issue type");
      });
    }

    function startIssueTypeEdit(issueType: RecordAny) {
      setEditingIssueTypeId(String(issueType._id));
      setIssueTypeForm({ name: issueType.name || "", idjira: issueType.idjira || "" });
      setActiveTab("issue-types");
    }

    function cancelIssueTypeEdit() {
      setEditingIssueTypeId("");
      setIssueTypeForm({ name: "", idjira: "" });
    }

    async function deleteIssueType(issueTypeId: string) {
      setMessage("Confirming delete issue type...");
      setConfirmDialog({
        title: "Xoa issue type nay?",
        description: "Thao tac nay khong the hoan tac.",
        confirmLabel: "Xoa",
        onConfirm: async () => {
          await withAction(async () => {
            await apiRequest(`/api/issue-types/${issueTypeId}`, token, {
              method: "DELETE",
            });
            if (editingIssueTypeId === issueTypeId) {
              cancelIssueTypeEdit();
            }
            setMessage("Da xoa issue type");
          });
        },
      });
    }

  function startVersionEdit(version: RecordAny) {
    setEditingVersionId(String(version._id));
    setVersionForm({
      projectId: getId(version.project),
      name: version.name || "",
      idjira: version.idjira || "",
      releaseDate: version.releaseDate ? String(version.releaseDate).slice(0, 10) : "",
    });
    setActiveTab("versions");
  }

  function cancelVersionEdit() {
    setEditingVersionId("");
    setVersionForm({ projectId: "", name: "", idjira: "", releaseDate: "" });
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
      userKey: testCase.automation?.userKey || "",
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
      userKey: "",
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
            userKey: automationForm.userKey,
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
        userKey: "",
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

  async function deleteTestCasesBulk(testCaseIds: string[]) {
    if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
      return;
    }

    setMessage("Confirming bulk delete...");
    setConfirmDialog({
      title: `Xoa ${testCaseIds.length} test case?`,
      description: "Thao tac nay khong the hoan tac.",
      confirmLabel: "Xoa tat ca",
      onConfirm: async () => {
        await withAction(async () => {
          for (const id of testCaseIds) {
            await apiRequest(`/api/test-cases/${id}`, token, {
              method: "DELETE",
            });
          }
          setMessage("Da xoa nhieu test case");
        });
      },
    });
  }

  async function duplicateTestCase(testCase: RecordAny) {
    if (!testCase) return;
    await withAction(async () => {
      const originalKey = String(testCase.caseKey || "TC").toUpperCase();
      const suffix = String(Date.now()).slice(-4);
      const caseKey = `${originalKey}-COPY-${suffix}`;
      const stepsSource = Array.isArray(testCase.steps) ? testCase.steps : [];
      const expectedValue = testCase.expected || stepsSource[0]?.expected || "Same as original";
      const steps = stepsSource.length
        ? stepsSource.map((step: RecordAny, index: number) => ({
            action: step.action || `Step ${index + 1}`,
            expected: expectedValue,
          }))
        : [{ action: "Follow original", expected: expectedValue }];

      const automationSteps = Array.isArray(testCase.automation?.steps)
        ? testCase.automation.steps.map((step: RecordAny, index: number) => ({
            order: index + 1,
            action: step.action || "goto",
            targetType: step.targetType || "css",
            target: step.target || "",
            value: step.value || "",
            expected: step.expected || "",
            timeoutMs: Number(step.timeoutMs || 15000),
          }))
        : [];

      await apiRequest("/api/test-cases", token, {
        method: "POST",
        body: JSON.stringify({
          projectId: getId(testCase.project),
          groupId: getId(testCase.group),
          caseKey,
          title: `${testCase.title || "Test case"} (Copy)`,
          priority: testCase.priority || "medium",
          severity: testCase.severity || "major",
          type: testCase.type || "functional",
          description: testCase.description || "",
          steps,
          automation: {
            enabled: Boolean(testCase.automation?.enabled),
            userKey: testCase.automation?.userKey || "",
            baseUrl: testCase.automation?.baseUrl || "",
            runner: "playwright",
            steps: automationSteps,
          },
        }),
      });

      setMessage("Da duplicate test case");
    });
  }

  async function duplicateTestCasesBulk(testCases: RecordAny[]) {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return;
    }

    await withAction(async () => {
      for (const testCase of testCases) {
        await duplicateTestCase(testCase);
      }
      setMessage("Da duplicate nhieu test case");
    });
  }

  async function duplicatePlan(plan: RecordAny) {
    if (!plan) return;
    await withAction(async () => {
      const suffix = String(Date.now()).slice(-4);
      const caseIds = Array.isArray(plan.items)
        ? plan.items.map((item: RecordAny) => String(getId(item.testCase) || item.testCase)).filter(Boolean)
        : [];
      if (caseIds.length === 0) {
        throw new Error("Plan khong co test case de duplicate");
      }

      await apiRequest("/api/test-plans", token, {
        method: "POST",
        body: JSON.stringify({
          name: `${plan.name || "Test plan"} (Copy ${suffix})`,
          description: plan.description || "",
          projectId: getId(plan.project),
          versionId: getId(plan.version),
          caseIds,
          executionMode: plan.executionMode || "manual",
        }),
      });

      setMessage("Da duplicate test plan");
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
    notes: string,
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
          body: JSON.stringify({ status, note, notes }),
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
    deleteTestCasesBulk,
    duplicateTestCase,
    duplicateTestCasesBulk,
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
    duplicatePlan,
    createVersion,
    issueTypes,
    issueTypeForm,
    setIssueTypeForm,
    createIssueType,
    editingIssueTypeId,
    startIssueTypeEdit,
    cancelIssueTypeEdit,
    deleteIssueType,
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
    openJiraBugDialog,
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
      {jiraBugDialog && (
        <div className="tcm-confirm-overlay" role="presentation">
          <div className="jira-bug-modal" role="dialog" aria-modal="true" aria-labelledby="jira-bug-title">
            <div className="jira-bug-modal__header">
              <div className="jira-bug-modal__titleblock">
                <h3 id="jira-bug-title">Log Bug</h3>
                <p>Review the Jira payload, adjust the editable fields, then submit the issue.</p>
              </div>
              <button type="button" className="tcm-toast__close" onClick={closeJiraBugDialog} aria-label="Close dialog">
                ×
              </button>
            </div>
            {jiraBugDialog.error && <div className="jira-bug-modal__alert">{jiraBugDialog.error}</div>}
            <div className="jira-bug-modal__summary">
              <div><span>Project</span><strong>{jiraBugDialog.projectName || "-"}</strong></div>
              <div><span>Run</span><strong>{jiraBugDialog.runId || "-"}</strong></div>
              <div><span>Case</span><strong>{jiraBugDialog.caseKey} - {jiraBugDialog.caseTitle}</strong></div>
            </div>
            <div className="jira-bug-modal__body">
              <section className="jira-bug-modal__section">
                <div className="jira-bug-modal__section-head">
                  <div>
                    <span>Jira mapping</span>
                    <h4>Project and issue metadata</h4>
                  </div>
                  <p>These fields control where the bug is created.</p>
                </div>
                <div className="workspace-form jira-bug-modal__form">
                  <div className="workspace-form__grid workspace-form__grid--two">
                    <label>
                      <span>Issue type</span>
                      <select value={jiraBugDialog.issueType} onChange={(e) => updateJiraBugDialog({ issueType: e.target.value })}>
                        <option value="">Select issue type</option>
                        {jiraIssueTypeOptions.map((it) => (
                          <option key={String(it._id)} value={it.idjira || it._id}>{it.name} {it.idjira ? `(${it.idjira})` : ''}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select value={jiraBugDialog.priority} onChange={(e) => updateJiraBugDialog({ priority: e.target.value })}>
                        <option value="1">1 - Highest</option>
                        <option value="2">2 - High</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4 - Low</option>
                        <option value="5">5 - Lowest</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="jira-bug-modal__section jira-bug-modal__section--wide">
                <div className="jira-bug-modal__section-head">
                  <div>
                    <span>Bug content</span>
                    <h4>Text that will be sent to Jira</h4>
                  </div>
                  <p>Keep summary short and description detailed.</p>
                </div>
                <div className="workspace-form jira-bug-modal__form">
                  <label>
                    <span>Summary</span>
                    <input value={jiraBugDialog.summary} onChange={(e) => updateJiraBugDialog({ summary: e.target.value })} />
                  </label>
                  <label>
                    <span>Description</span>
                    <textarea rows={9} value={jiraBugDialog.description} onChange={(e) => updateJiraBugDialog({ description: e.target.value })} />
                  </label>
                  <label>
                    <span>Labels</span>
                    <input value={jiraBugDialog.labels} onChange={(e) => updateJiraBugDialog({ labels: e.target.value })} placeholder="BE, FE" />
                  </label>
                  <label>
                    <span>Original Estimate</span>
                    <input
                      value={jiraBugDialog.originalEstimate}
                      onChange={(e) => updateJiraBugDialog({ originalEstimate: e.target.value })}
                      placeholder="eg. 3w 4d 12h"
                    />
                  </label>
                </div>
              </section>

              <section className="jira-bug-modal__section">
                <div className="jira-bug-modal__section-head">
                  <div>
                    <span>Assignee</span>
                      <h4>Search Jira users</h4>
                  </div>
                </div>
                  <div className="workspace-form jira-bug-modal__form">
                    <label>
                      <span>Search assignee</span>
                      <input
                        value={assigneeQuery || selectedAssigneeLabel}
                        onChange={(e) => {
                          if (jiraBugDialog?.assignee && !assigneeQuery && e.target.value !== selectedAssigneeLabel) {
                            updateJiraBugDialog({ assignee: '' });
                          }
                          setAssigneeQuery(e.target.value);
                          setAssigneeDropdownOpen(true);
                          setAssigneeLoading(true);
                        }}
                        onFocus={() => {
                          setAssigneeDropdownOpen(true);
                          if (!assigneeQuery && selectedAssigneeLabel) {
                            setAssigneeQuery('');
                          }
                        }}
                        placeholder="Type a Jira username"
                      />
                    </label>

                    {jiraBugDialog?.assignee ? (
                      <div className="jira-bug-modal__selected-assignee">
                        <div className="jira-bug-modal__selected-assignee-label">Selected assignee</div>
                        <div className="jira-bug-modal__selected-assignee-card">
                          <div>
                            <strong>{selectedAssigneeDetail?.displayName || selectedAssigneeDetail?.name || selectedAssigneeLabel || jiraBugDialog.assignee}</strong>
                            <span style={{ marginLeft: 8, color: '#6b7280', fontSize: '0.95em' }}>{selectedAssigneeDetail?.emailAddress || selectedAssigneeDetail?.name || jiraBugDialog.assignee}</span>
                          </div>
                          <button
                            type="button"
                            className="workspace-secondary"
                            onClick={() => {
                              updateJiraBugDialog({ assignee: '' });
                              setAssigneeQuery('');
                              setAssigneeDropdownOpen(true);
                            }}
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {assigneeDropdownOpen ? (
                      <div className="jira-bug-modal__assignee-list" role="listbox">
                        {assigneeLoading ? (
                          <div className="jira-bug-modal__assignee-item">Searching Jira...</div>
                        ) : assigneeOptions.length > 0 ? (
                          assigneeOptions.map((a) => (
                            <div
                              key={String(a.name || a.key || a.accountId || a.displayName)}
                              className="jira-bug-modal__assignee-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const nextAssignee = getAssigneeValue(a);
                                updateJiraBugDialog({ assignee: nextAssignee });
                                setAssigneeQuery('');
                                setAssigneeDropdownOpen(false);
                                setAssigneeLoading(false);
                              }}
                              role="option"
                              aria-selected={jiraBugDialog?.assignee === String(a.name || a.key || a.accountId || '')}
                            >
                              <strong>{a.displayName || a.name || a.key}</strong>
                              <span>{a.emailAddress || a.name || a.key}</span>
                            </div>
                          ))
                        ) : (
                          <div className="jira-bug-modal__assignee-item">No users matched</div>
                        )}
                      </div>
                    ) : null}

                    <div className="workspace-note">The selected username will be sent to Jira as the assignee.</div>
                  </div>
              </section>
            </div>
            <div className="jira-bug-modal__footer">
              <div className="jira-bug-modal__footer-note">
                Fields above are editable; the run, case, and description template are prefilled from the selected failure.
              </div>
              <div className="workspace-inline-actions workspace-inline-actions--right">
                <button type="button" className="workspace-secondary" onClick={closeJiraBugDialog} disabled={jiraBugDialog.submitting}>
                  Cancel
                </button>
                <button type="button" className="workspace-danger" onClick={() => void submitJiraBug()} disabled={jiraBugDialog.submitting || !jiraBugDialog.issueType}>
                  {jiraBugDialog.submitting ? "Creating..." : "Create bug"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <RoleWorkspace workspace={workspace} />
    </>
  );
}









