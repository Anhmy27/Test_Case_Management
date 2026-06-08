"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExecutionScreen from "@/components/workspaceScreens/ExecutionScreen";
import { useAdminWorkspace, useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton, TOPBAR_INPUT_CLS } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, formatAutomationRunMessage, getId, resolveStartRunPayload, summarizeAutomationResults, userName } from "@/lib/api";
import {
  buildEmployeeTopbar,
  useEmployeeProjectScope,
} from "@/components/workspaceScreens/employeeNav";
import { useJiraBugDialog } from "@/components/jira/useJiraBugDialog";

type RecordAny = Record<string, any>;

export default function WorkspaceExecutionRoute({ role }: { role: "admin" | "employee" }) {
  if (role === "admin") {
    return <AdminWorkspaceExecutionRoute />;
  }

  return <EmployeeWorkspaceExecutionRoute />;
}

function AdminWorkspaceExecutionRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = String(searchParams.get("runId") || "").trim();
  const testPlanIdFromUrl = String(searchParams.get("testPlanId") || "").trim();
  const runNameFromUrl = String(searchParams.get("runName") || "").trim();
  const adminExecutionPath = "/workspace/admin/test-runs-execution";
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
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
  const [cancellingRun, setCancellingRun] = useState(false);
  const [retryingRun, setRetryingRun] = useState(false);
  const [message, setMessage] = useState("");
  const [startRunError, setStartRunError] = useState("");
  const [pollError, setPollError] = useState("");
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    token,
    onNotice: setMessage,
  });
  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setMessage("");

      try {
        const [plansResponse, runsResponse, projectsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>(
            selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans",
            token,
          ),
          apiRequest<{ testRuns: RecordAny[] }>(
            selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs",
            token,
          ),
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
        ]);
        if (cancelled) return;

        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
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
  }, [currentUser, runNameFromUrl, selectedProjectId, testPlanIdFromUrl, token]);

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

  const scopedPlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const activeRun = runIdFromUrl ? selectedRun : null;
  const activeMyItems = runIdFromUrl ? myItems : [];
  const currentUserId = getId(currentUser);
  const matchesSearch = useMemo(() => createTextMatcher(), []);
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
    setStartRunError("");
  }, [runForm.name, runForm.testPlanId]);

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
  const canControlAutomationRun = Boolean(
    activeRun &&
      isActiveRunAutomation &&
      currentUser &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser.role === "admin"),
  );

  useEffect(() => {
    if (!shouldPollAutomationRun || !token) {
      setPollError("");
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
        setPollError("");
      } catch {
        if (!cancelled) {
          setPollError("Connection lost while refreshing automation progress. Retrying...");
        }
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

  const refreshRuns = async () => {
    const response = await apiRequest<{ testRuns: RecordAny[] }>(
      selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs",
      token,
    );
    setRuns(Array.isArray(response.testRuns) ? response.testRuns : []);
  };

  const openRun = (runId: string) => {
    router.push(`${adminExecutionPath}?runId=${encodeURIComponent(runId)}`);
  };

  const startRun = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!runForm.testPlanId || startingRun) return;

    const selectedPlan = scopedPlans.find((plan) => getId(plan) === runForm.testPlanId) || null;
    const resolved = resolveStartRunPayload({
      testPlanId: runForm.testPlanId,
      name: runForm.name,
      baseUrl: runForm.baseUrl,
      plan: selectedPlan,
      existingRuns: runs,
      allPlans: scopedPlans,
    });

    if (resolved.error || !resolved.payload) {
      setStartRunError(resolved.error || "Unable to start run");
      return;
    }

    setStartingRun(true);
    setMessage("");
    setStartRunError("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(resolved.payload),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
        setRunForm((prev) => ({ ...prev, name: resolved.payload!.name }));
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
          router.push(`${adminExecutionPath}?runId=${encodeURIComponent(runId)}`);
        }
      }
      await refreshRuns();
    } catch (error) {
      setStartRunError(error instanceof Error ? error.message : "Unable to start run");
    } finally {
      setStartingRun(false);
    }
  };

  const loadMyItems = async (runId: string) => {
    const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(`/api/test-runs/${runId}/my-items`, token);
    if (response.testRun) {
      setSelectedRun(response.testRun);
      setRuns((prev) => {
        const nextRunId = getId(response.testRun);
        const filtered = prev.filter((run) => getId(run) !== nextRunId);
        return [response.testRun as RecordAny, ...filtered];
      });
    }
    setMyItems(Array.isArray(response.results) ? response.results : []);
  };

  const updateResult = async (resultId: string, status: "pass" | "fail" | "blocked" | "skip", note: string, resultNotes: string) => {
    if (!selectedRun) return;
    await apiRequest(`/api/test-runs/${getId(selectedRun)}/results/${resultId}`, token, { method: "PATCH", body: JSON.stringify({ status, note, notes: resultNotes }) });
    await loadMyItems(getId(selectedRun));
    await refreshRuns();
  };

  const endRun = async (runId: string) => {
    await apiRequest(`/api/test-runs/${runId}/end`, token, { method: "PATCH" });
    if (runId) {
      await loadMyItems(runId);
      await refreshRuns();
    }
  };

  const cancelAutomationRun = async () => {
    if (!activeRun || !token) return;
    setCancellingRun(true);
    setMessage("");
    try {
      await apiRequest(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/cancel`, token, {
        method: "POST",
      });
      setMessage("Đang dừng automation run...");
      await loadMyItems(getId(activeRun));
      await refreshRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel automation run");
    } finally {
      setCancellingRun(false);
    }
  };

  const retryFailedAutomation = async () => {
    if (!activeRun || !token) return;
    setRetryingRun(true);
    setMessage("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        retryCount?: number;
      }>(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/retry-failed`, token, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: runForm.baseUrl || activeRun.automationBaseUrl || "",
        }),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
      }
      setMessage(`Đang retry ${response.retryCount ?? 0} case fail...`);
      await loadMyItems(getId(activeRun));
      await refreshRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retry failed cases");
    } finally {
      setRetryingRun(false);
    }
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Test Runs + Execution</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
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
  }, [projects, selectedProjectId, setSelectedProjectId, setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {pollError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{pollError}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
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
          canControlAutomationRun={canControlAutomationRun}
          cancellingRun={cancellingRun}
          retryingRun={retryingRun}
          onCancelAutomationRun={cancelAutomationRun}
          onRetryFailedAutomation={retryFailedAutomation}
          token={token}
          onLogBug={openJiraBugDialog}
          adminRuns={runs}
          onOpenRun={openRun}
          currentUserId={currentUserId}
          userName={userName}
          matchesSearch={matchesSearch}
          startRunError={startRunError}
        />
      )}
      {jiraBugDialogNode}
    </>
  );
}

function EmployeeWorkspaceExecutionRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = String(searchParams.get("runId") || "").trim();
  const testPlanIdFromUrl = String(searchParams.get("testPlanId") || "").trim();
  const runNameFromUrl = String(searchParams.get("runName") || "").trim();
  const { token, currentUser, setTopbar } = useEmployeeWorkspace();
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
  const [cancellingRun, setCancellingRun] = useState(false);
  const [retryingRun, setRetryingRun] = useState(false);
  const [message, setMessage] = useState("");
  const [startRunError, setStartRunError] = useState("");
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    token,
    onNotice: setMessage,
  });
  const employeeProjectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setMessage("");

      try {
        const [plansResponse, runsResponse, projectsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>("/api/test-plans", token),
          apiRequest<{ testRuns: RecordAny[] }>("/api/test-runs", token),
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
        ]);
        if (cancelled) return;

        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
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
  }, [currentUser, runNameFromUrl, testPlanIdFromUrl, token]);

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
    return employeeProjectScope.filterPlans(safePlans);
  }, [employeeProjectScope, plans]);
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
    setStartRunError("");
  }, [runForm.name, runForm.testPlanId]);

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
  const canControlAutomationRun = Boolean(
    activeRun &&
      isActiveRunAutomation &&
      currentUser &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser.role === "admin"),
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

    const selectedPlan = scopedPlans.find((plan) => getId(plan) === runForm.testPlanId) || null;
    const resolved = resolveStartRunPayload({
      testPlanId: runForm.testPlanId,
      name: runForm.name,
      baseUrl: runForm.baseUrl,
      plan: selectedPlan,
      existingRuns: runs,
      allPlans: scopedPlans,
    });

    if (resolved.error || !resolved.payload) {
      setStartRunError(resolved.error || "Unable to start run");
      return;
    }

    setStartingRun(true);
    setMessage("");
    setStartRunError("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(resolved.payload),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
        const runId = getId(response.testRun);
        if (runId) {
          if (response.automationQueued) {
            setMyItems([]);
            setMessage("Automation Ä‘ang cháº¡y ná»n. Káº¿t quáº£ sáº½ cáº­p nháº­t tá»± Ä‘á»™ng.");
          } else if (response.automationSummary) {
            setMessage(formatAutomationRunMessage(response.automationSummary));
          } else {
            setMessage("Test run started");
          }
          router.push(`/workspace/employee/execution?runId=${encodeURIComponent(runId)}`);
        }
      }
    } catch (error) {
      setStartRunError(error instanceof Error ? error.message : "Unable to start run");
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

  const cancelAutomationRun = async () => {
    if (!activeRun || !token) return;
    setCancellingRun(true);
    setMessage("");
    try {
      await apiRequest(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/cancel`, token, {
        method: "POST",
      });
      setMessage("Äang dá»«ng automation run...");
      await loadMyItems(getId(activeRun));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel automation run");
    } finally {
      setCancellingRun(false);
    }
  };

  const retryFailedAutomation = async () => {
    if (!activeRun || !token) return;
    setRetryingRun(true);
    setMessage("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        retryCount?: number;
      }>(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/retry-failed`, token, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: runForm.baseUrl || activeRun.automationBaseUrl || "",
        }),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
      }
      setMessage(`Äang retry ${response.retryCount ?? 0} case fail...`);
      await loadMyItems(getId(activeRun));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retry failed cases");
    } finally {
      setRetryingRun(false);
    }
  };

  useLayoutEffect(() => {
    setTopbar(
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
      }),
    );

    return () => setTopbar(null);
  }, [
    employeeProjectScope.safeProjects,
    employeeProjectScope.scopeLabel,
    employeeProjectScope.selectedProjectId,
    employeeProjectScope.setSelectedProjectId,
    runs.length,
    scopedPlans.length,
    setTopbar,
  ]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
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
          canControlAutomationRun={canControlAutomationRun}
          cancellingRun={cancellingRun}
          retryingRun={retryingRun}
          onCancelAutomationRun={cancelAutomationRun}
          onRetryFailedAutomation={retryFailedAutomation}
          token={token}
          onLogBug={openJiraBugDialog}
          startRunError={startRunError}
        />
      )}
      {jiraBugDialogNode}
    </>
  );
}
