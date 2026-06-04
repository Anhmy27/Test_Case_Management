"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ExecutionScreen from "@/components/workspaceScreens/ExecutionScreen";
import { apiRequest, formatAutomationRunMessage, getId, summarizeAutomationResults, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";
import {
  EMPLOYEE_NAV_ITEMS,
  buildEmployeeTopbar,
  useEmployeeProjectScope,
} from "@/components/workspaceScreens/employeeNav";
import { useJiraBugDialog } from "@/components/jira/useJiraBugDialog";

type RecordAny = Record<string, any>;

function getStoredToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || "";
}

function getStoredProject() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || "";
}

export default function WorkspaceExecutionRoute({ role }: { role: "admin" | "employee" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = String(searchParams.get("runId") || "").trim();
  const testPlanIdFromUrl = String(searchParams.get("testPlanId") || "").trim();
  const runNameFromUrl = String(searchParams.get("runName") || "").trim();
  const [selectedProjectId] = useState<string>(() => getStoredProject());
  const adminNavItems = useAdminSidebarNav(selectedProjectId, "execution", router, {
    enabled: role === "admin",
  });
  const [token] = useState<string>(() => getStoredToken());
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [selectedRun, setSelectedRun] = useState<RecordAny | null>(null);
  const [myItems, setMyItems] = useState<RecordAny[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "", baseUrl: "" });
  const [loading, setLoading] = useState(true);
  const [startingRun, setStartingRun] = useState(false);
  const [message, setMessage] = useState("");
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    token,
    onNotice: setMessage,
  });
  const employeeProjectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setMessage("");

      try {
        const meResponse = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        const me = meResponse.user;
        if (!me) {
          router.replace("/");
          return;
        }
        if (role === "admin" && me.role !== "admin") {
          router.replace("/workspace/employee/my-test-plans");
          return;
        }
        if (role === "employee" && me.role === "admin") {
          router.replace("/workspace/admin/dashboard");
          return;
        }

        const plansPromise = apiRequest<{ testPlans: RecordAny[] }>(
          role === "admin" && selectedProjectId
            ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}`
            : "/api/test-plans",
          token,
        );
        const runsPromise = apiRequest<{ testRuns: RecordAny[] }>(
          role === "admin" && selectedProjectId
            ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}`
            : "/api/test-runs",
          token,
        );
        const projectsPromise =
          role === "employee"
            ? apiRequest<{ projects: RecordAny[] }>("/api/projects", token)
            : Promise.resolve(null);

        const [plansResponse, runsResponse, projectsResponse] = await Promise.all([
          plansPromise,
          runsPromise,
          projectsPromise,
        ]);
        if (cancelled) return;

        setCurrentUser(me);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
        if (projectsResponse) {
          setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        }
        if (testPlanIdFromUrl) {
          setRunForm((prev) => ({ ...prev, testPlanId: testPlanIdFromUrl, name: runNameFromUrl || prev.name }));
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load execution workspace");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [role, router, runNameFromUrl, selectedProjectId, testPlanIdFromUrl, token]);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    if (!runIdFromUrl) {
      return;
    }

    let cancelled = false;

    const loadRun = async () => {
      try {
        const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(
          `/api/test-runs/${encodeURIComponent(runIdFromUrl)}/my-items`,
          token,
        );

        if (cancelled) {
          return;
        }

        if (response.testRun) {
          setSelectedRun(response.testRun);
          setRuns((prev) => {
            const nextRunId = getId(response.testRun);
            const filtered = prev.filter((run) => getId(run) !== nextRunId);
            return [response.testRun as RecordAny, ...filtered];
          });
        } else {
          setSelectedRun(null);
          setMessage("Test run not found");
        }

        setMyItems(Array.isArray(response.results) ? response.results : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load test run");
          setSelectedRun(null);
          setMyItems([]);
        }
      }
    };

    void loadRun();

    return () => {
      cancelled = true;
    };
  }, [currentUser, runIdFromUrl, token]);

  const scopedPlans = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (role === "employee") {
      return employeeProjectScope.filterPlans(safePlans);
    }

    return safePlans;
  }, [employeeProjectScope, plans, role]);
  const activeRun = runIdFromUrl ? selectedRun : null;
  const activeMyItems = runIdFromUrl ? myItems : [];
  const selectedRunPlan = scopedPlans.find((plan) => getId(plan) === runForm.testPlanId) || activeRun?.testPlan || null;
  const selectedRunPlanIsAutomation = String(selectedRunPlan?.executionMode || "manual") === "automation";
  const isActiveRunAutomation =
    String(activeRun?.testPlan?.executionMode || selectedRunPlan?.executionMode || "manual") === "automation";
  const shouldPollAutomationRun = Boolean(
    runIdFromUrl &&
      activeRun &&
      activeRun.status === "running" &&
      selectedRunPlanIsAutomation,
  );
  const selectedItem = activeMyItems.find((item) => getId(item) === selectedItemId);

  useEffect(() => {
    if (!activeMyItems.length) {
      setSelectedItemId("");
      return;
    }

    if (!selectedItemId || !activeMyItems.some((item) => getId(item) === selectedItemId)) {
      const preferred =
        activeMyItems.find((item) => item.status === "fail") ||
        activeMyItems.find((item) => item.status === "blocked") ||
        activeMyItems[0];
      setSelectedItemId(getId(preferred));
    }
  }, [activeMyItems, selectedItemId]);

  const canEditSelectedRun = Boolean(
    activeRun &&
      activeRun.status === "running" &&
      !isActiveRunAutomation &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser?.role === "admin"),
  );

  useEffect(() => {
    if (!shouldPollAutomationRun || !token) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(
          `/api/test-runs/${encodeURIComponent(runIdFromUrl)}/my-items`,
          token,
        );
        if (cancelled) {
          return;
        }

        if (response.testRun) {
          setSelectedRun(response.testRun);
          if (response.testRun.status === "completed") {
            setMessage(formatAutomationRunMessage(summarizeAutomationResults(response.results || [])));
          }
        }
        setMyItems(Array.isArray(response.results) ? response.results : []);
      } catch {
        // Keep polling passive to avoid noisy UI.
      }
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [runIdFromUrl, shouldPollAutomationRun, token]);

  const startRun = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!runForm.testPlanId || startingRun) return;
    setStartingRun(true);
    setMessage("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify({
          testPlanId: runForm.testPlanId,
          name: runForm.name,
          baseUrl: runForm.baseUrl || "",
        }),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
        const runId = getId(response.testRun);
        if (runId) {
          if (response.automationQueued) {
            setMyItems([]);
            setMessage("Automation đang chạy nền. Kết quả sẽ cập nhật tự động.");
          } else if (response.automationSummary) {
            setMessage(formatAutomationRunMessage(response.automationSummary));
          } else {
            setMessage("Test run started");
          }
          router.push(`${role === "admin" ? "/workspace/admin/execution" : "/workspace/employee/execution"}?runId=${encodeURIComponent(runId)}`);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start run");
    } finally {
      setStartingRun(false);
    }
  };

  const loadMyItems = async (runId: string) => {
    const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(`/api/test-runs/${runId}/my-items`, token);
    if (response.testRun) setSelectedRun(response.testRun);
    setMyItems(Array.isArray(response.results) ? response.results : []);
  };

  const updateResult = async (resultId: string, status: "pass" | "fail" | "blocked" | "skip", note: string, resultNotes: string) => {
    if (!selectedRun) return;
    await apiRequest(`/api/test-runs/${getId(selectedRun)}/results/${resultId}`, token, { method: "PATCH", body: JSON.stringify({ status, note, notes: resultNotes }) });
    await loadMyItems(getId(selectedRun));
  };

  const endRun = async (runId: string) => {
    await apiRequest(`/api/test-runs/${runId}/end`, token, { method: "PATCH" });
    if (runId) {
      await loadMyItems(runId);
    }
  };

  const handleNavigate = (tab: string) => {
    router.push(role === "admin" ? `/workspace/admin/${tab}` : `/workspace/employee/${tab}`);
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tcm_token");
      window.localStorage.removeItem("tcm_selected_project_id");
    }
    router.replace("/");
  };

  const topbar =
    role === "employee" ? (
      buildEmployeeTopbar({
        tabLabel: "Run Test",
        scopeLabel: employeeProjectScope.scopeLabel,
        selectedProjectId: employeeProjectScope.selectedProjectId,
        projects: employeeProjectScope.safeProjects,
        onProjectChange: employeeProjectScope.setSelectedProjectId,
        stats: [
          { label: "projects", value: employeeProjectScope.safeProjects.length },
          { label: "plans", value: scopedPlans.length },
          { label: "runs", value: runs.length },
        ],
        onLogout: handleLogout,
      })
    ) : (
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Execution</div>
          <div className="text-xs text-slate-500">Route-local execution workspace</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button>
        </div>
      </div>
    );

  if (loading && !currentUser) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading execution workspace...</div>;
  }

  if (!currentUser) return null;

  return (
    <AppShell
      brand={{ title: "Test Case Management", subtitle: role === "admin" ? "Admin workspace" : "Employee workspace" }}
      user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }}
      navItems={role === "admin" ? adminNavItems : EMPLOYEE_NAV_ITEMS}
      activeKey="execution"
      onNavChange={handleNavigate}
      topbar={topbar}
    >
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      <ExecutionScreen
        runForm={runForm}
        setRunForm={setRunForm}
        startRun={startRun}
        startingRun={startingRun}
        scopedPlans={scopedPlans}
        selectedRunPlanIsAutomation={selectedRunPlanIsAutomation}
        selectedRun={activeRun}
        myItems={activeMyItems}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        selectedItem={selectedItem || undefined}
        notes={notes}
        setNotes={setNotes}
        updateResult={updateResult}
        endRun={endRun}
        canEditSelectedRun={canEditSelectedRun}
        token={token}
        onLogBug={openJiraBugDialog}
      />
      {jiraBugDialogNode}
    </AppShell>
  );
}