"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExecutionScreen from "@/components/workspaceScreens/ExecutionScreen";
import { useAdminWorkspace, useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, buildDefaultRunName, downloadTestRunExport, formatAutomationRunMessage, getId, partitionRunItemsByAutomation, resolveStartRunPayload, runHasAutomationItems, runHasManualItems, summarizeAutomationResults, userName } from "@/lib/api";
import AdminTestPlanInsightsModal from "@/components/workspaceScreens/AdminTestPlanInsightsModal";
import {
  buildEmployeeTopbar,
  useEmployeeProjectScope,
} from "@/components/workspaceScreens/employeeNav";
import { useJiraBugDialog } from "@/components/jira/useJiraBugDialog";

type RecordAny = Record<string, any>;

function createExportRunHandler(
  setExportingRun: (value: boolean) => void,
  showNotice: (message: string, variant?: "success" | "error" | "info") => void,
) {
  return async (runId: string, format: "xlsx" | "csv" = "xlsx") => {
    setExportingRun(true);
    try {
      await downloadTestRunExport(runId, format);
      showNotice(`Exported run as ${format.toUpperCase()}`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to export run", "error");
    } finally {
      setExportingRun(false);
    }
  };
}

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
  const resultIdFromUrl = String(searchParams.get("resultId") || "").trim();
  const testPlanIdFromUrl = String(searchParams.get("testPlanId") || "").trim();
  const runNameFromUrl = String(searchParams.get("runName") || "").trim();
  const editRunFromUrl = searchParams.get("edit") === "1";
  const fromInsightsPlanId = String(searchParams.get("fromInsightsPlanId") || "").trim();
  const fromInsightsPlanName = String(searchParams.get("fromInsightsPlanName") || "").trim();
  const adminExecutionPath = "/workspace/admin/test-runs-execution";
  const { currentUser, selectedProjectId, setTopbar, showNotice } = useAdminWorkspace();
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
  const [exportingRun, setExportingRun] = useState(false);
  const [savingRunName, setSavingRunName] = useState(false);
  const [startRunError, setStartRunError] = useState("");
  const [pollError, setPollError] = useState("");
  const [insightsPlan, setInsightsPlan] = useState<{
    planId: string;
    planName?: string;
    projectId?: string;
  } | null>(null);
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    onNotice: showNotice,
  });

  useEffect(() => {
    if (pollError) {
      showNotice(pollError, "error");
    }
  }, [pollError, showNotice]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [plansResponse, runsResponse, projectsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>(
            selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans",
            undefined,
          ),
          apiRequest<{ testRuns: RecordAny[] }>(
            selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs",
            undefined,
          ),
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
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
          showNotice(error instanceof Error ? error.message : "Unable to load execution workspace", "error");
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
  }, [currentUser, runNameFromUrl, selectedProjectId, testPlanIdFromUrl]);

  useEffect(() => {
    if (!currentUser) {
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
          undefined,
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
          showNotice("Test run not found", "error");
        }

        setMyItems(Array.isArray(response.results) ? response.results : []);
      } catch (error) {
        if (!cancelled) {
          showNotice(error instanceof Error ? error.message : "Unable to load test run", "error");
          setSelectedRun(null);
          setMyItems([]);
        }
      }
    };

    void loadRun();

    return () => {
      cancelled = true;
    };
  }, [currentUser, runIdFromUrl]);

  const scopedPlans = useMemo(() => (Array.isArray(plans) ? plans : []), [plans]);
  const activeRun = runIdFromUrl ? selectedRun : null;
  const activeMyItems = useMemo(
    () => (runIdFromUrl ? myItems : []),
    [runIdFromUrl, myItems],
  );
  const runHasAutomation = runHasAutomationItems(activeMyItems);
  const runHasManual = runHasManualItems(activeMyItems);
  const shouldPollAutomationRun = Boolean(
    runIdFromUrl &&
      activeRun &&
      activeRun.status === "running" &&
      runHasAutomation,
  );
  const selectedItem = activeMyItems.find((item) => getId(item) === selectedItemId);
  const hasRunAssignments = activeMyItems.length > 0;

  useEffect(() => {
    setStartRunError("");
  }, [runForm.name, runForm.testPlanId]);

  useEffect(() => {
    if (!activeMyItems.length) {
      setSelectedItemId("");
      return;
    }

    if (resultIdFromUrl && activeMyItems.some((item) => getId(item) === resultIdFromUrl)) {
      if (selectedItemId !== resultIdFromUrl) {
        setSelectedItemId(resultIdFromUrl);
      }
      return;
    }

    if (!selectedItemId || !activeMyItems.some((item) => getId(item) === selectedItemId)) {
      const { manualItems, automationItems } = partitionRunItemsByAutomation(activeMyItems);
      const selectionPool = manualItems.length > 0 ? manualItems : automationItems;
      const preferred =
        selectionPool.find((item) => item.status === "fail") ||
        selectionPool.find((item) => item.status === "blocked") ||
        selectionPool[0] ||
        activeMyItems[0];
      setSelectedItemId(getId(preferred));
    }
  }, [activeMyItems, resultIdFromUrl, selectedItemId]);

  const canEditSelectedRun = Boolean(
    activeRun &&
      runHasManual &&
      ((activeRun.status === "running" &&
        (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
          currentUser?.role === "admin" ||
          hasRunAssignments)) ||
        (editRunFromUrl &&
          activeRun.status === "completed" &&
          currentUser?.role === "admin")),
  );
  const canEndSelectedRun = Boolean(
    activeRun &&
      activeRun.status === "running" &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser?.role === "admin" ||
        hasRunAssignments),
  );
  const canUploadFailureScreenshot = Boolean(
    activeRun &&
      runHasManual &&
      ["running", "completed"].includes(String(activeRun.status || "")) &&
      (currentUser?.role === "admin" ||
        String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        hasRunAssignments),
  );
  const canControlAutomationRun = Boolean(
    activeRun &&
      runHasAutomation &&
      currentUser &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser.role === "admin"),
  );

  useEffect(() => {
    if (!shouldPollAutomationRun) {
      setPollError("");
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(
          `/api/test-runs/${encodeURIComponent(runIdFromUrl)}/my-items`,
          undefined,
        );
        if (cancelled) {
          return;
        }

        if (response.testRun) {
          setSelectedRun((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(response.testRun)) {
              return response.testRun;
            }
            return prev;
          });
          if (response.testRun.status === "completed") {
            showNotice(formatAutomationRunMessage(summarizeAutomationResults(response.results || [])));
          }
        }
        setMyItems((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(response.results)) {
            return Array.isArray(response.results) ? response.results : [];
          }
          return prev;
        });
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
  }, [runIdFromUrl, shouldPollAutomationRun]);

  const refreshRuns = async () => {
    const response = await apiRequest<{ testRuns: RecordAny[] }>(
      selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs",
      undefined,
    );
    setRuns(Array.isArray(response.testRuns) ? response.testRuns : []);
  };

  const openRun = (runId: string) => {
    router.push(`${adminExecutionPath}?runId=${encodeURIComponent(runId)}`);
  };

  const openRunForEdit = (runId: string) => {
    router.push(`${adminExecutionPath}?runId=${encodeURIComponent(runId)}&edit=1`);
  };

  const exitRunEdit = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("edit");
    const query = params.toString();
    router.replace(query ? `${adminExecutionPath}?${query}` : adminExecutionPath);
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
    setStartRunError("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", undefined, {
        method: "POST",
        body: JSON.stringify(resolved.payload),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
        // Reset form after successful creation to avoid stale duplicate-name warning.
        setRunForm({ testPlanId: "", name: "", baseUrl: "" });
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
        const runId = getId(response.testRun);
        if (runId) {
          if (response.automationQueued) {
            setMyItems([]);
            showNotice("Automation đang chạy nền. Kết quả sẽ cập nhật tự động.");
          } else if (response.automationSummary) {
            showNotice(formatAutomationRunMessage(response.automationSummary));
          } else {
            showNotice("Test run started");
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
    const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(`/api/test-runs/${runId}/my-items`, undefined);
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
    try {
      await apiRequest(`/api/test-runs/${getId(selectedRun)}/results/${resultId}`, undefined, { method: "PATCH", body: JSON.stringify({ status, note, notes: resultNotes }) });
      await loadMyItems(getId(selectedRun));
      await refreshRuns();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to update result", "error");
      throw error;
    }
  };

  const endRun = async (runId: string) => {
    await apiRequest(`/api/test-runs/${runId}/end`, undefined, { method: "PATCH" });
    if (runId) {
      await loadMyItems(runId);
      await refreshRuns();
    }
  };

  const cancelAutomationRun = async () => {
    if (!activeRun) return;
    setCancellingRun(true);
    try {
      await apiRequest(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/cancel`, undefined, {
        method: "POST",
      });
      showNotice("Đang dừng automation run...");
      await loadMyItems(getId(activeRun));
      await refreshRuns();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to cancel automation run", "error");
    } finally {
      setCancellingRun(false);
    }
  };

  const retryFailedAutomation = async () => {
    if (!activeRun) return;
    setRetryingRun(true);
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        retryCount?: number;
      }>(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/retry-failed`, undefined, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: runForm.baseUrl || activeRun.automationBaseUrl || "",
        }),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
      }
      showNotice(`Đang retry ${response.retryCount ?? 0} case fail...`);
      await loadMyItems(getId(activeRun));
      await refreshRuns();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to retry failed cases", "error");
    } finally {
      setRetryingRun(false);
    }
  };

  const handleExportRun = createExportRunHandler(setExportingRun, showNotice);

  const handleUpdateRun = async (runId: string, payload: { name: string }) => {
    const response = await apiRequest<{ testRun?: RecordAny | null }>(
      `/api/test-runs/${encodeURIComponent(runId)}`,
      undefined,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    if (response.testRun) {
      const updatedRun = response.testRun;
      setRuns((prev) =>
        prev.map((run) => (getId(run) === runId ? { ...run, ...updatedRun } : run)),
      );
      setSelectedRun((prev) =>
        prev && getId(prev) === runId ? { ...prev, ...updatedRun } : prev,
      );
    }

    showNotice("Test run updated");
  };

  const handleSaveRunName = async (name: string) => {
    if (!activeRun) {
      return;
    }
    setSavingRunName(true);
    try {
      await handleUpdateRun(getId(activeRun), { name });
      exitRunEdit();
    } finally {
      setSavingRunName(false);
    }
  };

  const openPlanInsights = (planId: string) => {
    const runEntityId = getId(activeRun?.testPlanEntityId);
    const resolvedPlanId = runEntityId || planId;
    const fromList = scopedPlans.find(
      (plan) => getId(plan) === resolvedPlanId || String(plan._id || "") === resolvedPlanId,
    );
    const fromRun =
      activeRun?.testPlan && getId(activeRun.testPlan) === resolvedPlanId ? activeRun.testPlan : null;
    const plan = fromList || fromRun;
    setInsightsPlan({
      planId: fromList ? getId(fromList) : resolvedPlanId,
      planName: String(plan?.name || activeRun?.testPlan?.name || ""),
      projectId: getId(plan?.project || activeRun?.project || selectedProjectId) || selectedProjectId || undefined,
    });
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        {fromInsightsPlanId ? (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            onClick={() => router.push(`/workspace/admin/test-plans?openInsightsPlanId=${encodeURIComponent(fromInsightsPlanId)}`)}
          >
            ← {fromInsightsPlanName ? `${fromInsightsPlanName} Insights` : "Back to Insights"}
          </button>
        ) : null}
        <h1 className="text-xl font-semibold text-slate-900">Test Runs + Execution</h1>
      </div>,
    );
    return () => setTopbar(null);
  }, [fromInsightsPlanId, fromInsightsPlanName, router, setTopbar]);

  return (
    <>
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <ExecutionScreen
          runForm={runForm}
          setRunForm={setRunForm}
          startRun={startRun}
          startingRun={startingRun}
          scopedPlans={scopedPlans}
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
          canEndSelectedRun={canEndSelectedRun}
          canUploadFailureScreenshot={canUploadFailureScreenshot}
          canControlAutomationRun={canControlAutomationRun}
          cancellingRun={cancellingRun}
          retryingRun={retryingRun}
          onCancelAutomationRun={cancelAutomationRun}
          onRetryFailedAutomation={retryFailedAutomation}
          onLogBug={openJiraBugDialog}
          adminRuns={runs}
          onOpenRun={openRun}
          userName={userName}
          startRunError={startRunError}
          onNotice={showNotice}
          onExportRun={handleExportRun}
          onOpenRunForEdit={openRunForEdit}
          runEditMode={editRunFromUrl && Boolean(activeRun)}
          onSaveRunName={handleSaveRunName}
          onCancelRunEdit={exitRunEdit}
          savingRunName={savingRunName}
          exportingRun={exportingRun}
          initialPlanFilter={testPlanIdFromUrl}
          onOpenPlanInsights={openPlanInsights}
          onRefreshRunItems={activeRun ? () => loadMyItems(getId(activeRun)) : undefined}
        />
      )}
      {jiraBugDialogNode}
      {insightsPlan ? (
        <AdminTestPlanInsightsModal
          planId={insightsPlan.planId}
          planName={insightsPlan.planName}
          projectId={insightsPlan.projectId}
          onClose={() => setInsightsPlan(null)}
          onOpenExecution={(runId) => {
            setInsightsPlan(null);
            openRun(runId);
          }}
          onStartNewRun={() => {
            const plan = scopedPlans.find((item) => getId(item) === insightsPlan.planId);
            setInsightsPlan(null);
            router.push(`${adminExecutionPath}?testPlanId=${encodeURIComponent(insightsPlan.planId)}&runName=${encodeURIComponent(buildDefaultRunName(
              String(plan?.name || insightsPlan.planName || ""),
              String(plan?.version?.name || ""),
            ))}`);
          }}
        />
      ) : null}
    </>
  );
}

function EmployeeWorkspaceExecutionRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = String(searchParams.get("runId") || "").trim();
  const resultIdFromUrl = String(searchParams.get("resultId") || "").trim();
  const testPlanIdFromUrl = String(searchParams.get("testPlanId") || "").trim();
  const runNameFromUrl = String(searchParams.get("runName") || "").trim();
  const { currentUser, setTopbar, showNotice } = useEmployeeWorkspace();
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
  const [exportingRun, setExportingRun] = useState(false);
  const [startRunError, setStartRunError] = useState("");
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    onNotice: showNotice,
  });
  const employeeProjectScope = useEmployeeProjectScope(projects);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [plansResponse, runsResponse, projectsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>("/api/test-plans"),
          apiRequest<{ testRuns: RecordAny[] }>("/api/test-runs"),
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
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
          showNotice(error instanceof Error ? error.message : "Unable to load execution workspace", "error");
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
  }, [currentUser, runNameFromUrl, testPlanIdFromUrl]);

  useEffect(() => {
    if (!currentUser) {
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
          undefined,
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
          showNotice("Test run not found", "error");
        }

        setMyItems(Array.isArray(response.results) ? response.results : []);
      } catch (error) {
        if (!cancelled) {
          showNotice(error instanceof Error ? error.message : "Unable to load test run", "error");
          setSelectedRun(null);
          setMyItems([]);
        }
      }
    };

    void loadRun();

    return () => {
      cancelled = true;
    };
  }, [currentUser, runIdFromUrl]);

  const scopedPlans = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    return employeeProjectScope.filterPlans(safePlans);
  }, [employeeProjectScope, plans]);
  const activeRun = runIdFromUrl ? selectedRun : null;
  const activeMyItems = useMemo(
    () => (runIdFromUrl ? myItems : []),
    [runIdFromUrl, myItems],
  );
  const runHasAutomation = runHasAutomationItems(activeMyItems);
  const runHasManual = runHasManualItems(activeMyItems);
  const shouldPollAutomationRun = Boolean(
    runIdFromUrl &&
      activeRun &&
      activeRun.status === "running" &&
      runHasAutomation,
  );
  const selectedItem = activeMyItems.find((item) => getId(item) === selectedItemId);
  const hasRunAssignments = activeMyItems.length > 0;

  useEffect(() => {
    setStartRunError("");
  }, [runForm.name, runForm.testPlanId]);

  useEffect(() => {
    if (!activeMyItems.length) {
      setSelectedItemId("");
      return;
    }

    if (resultIdFromUrl && activeMyItems.some((item) => getId(item) === resultIdFromUrl)) {
      if (selectedItemId !== resultIdFromUrl) {
        setSelectedItemId(resultIdFromUrl);
      }
      return;
    }

    if (!selectedItemId || !activeMyItems.some((item) => getId(item) === selectedItemId)) {
      const { manualItems, automationItems } = partitionRunItemsByAutomation(activeMyItems);
      const selectionPool = manualItems.length > 0 ? manualItems : automationItems;
      const preferred =
        selectionPool.find((item) => item.status === "fail") ||
        selectionPool.find((item) => item.status === "blocked") ||
        selectionPool[0] ||
        activeMyItems[0];
      setSelectedItemId(getId(preferred));
    }
  }, [activeMyItems, resultIdFromUrl, selectedItemId]);

  const canEditSelectedRun = Boolean(
    activeRun &&
      activeRun.status === "running" &&
      runHasManual &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser?.role === "admin" ||
        hasRunAssignments),
  );
  const canEndSelectedRun = Boolean(
    activeRun &&
      activeRun.status === "running" &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser?.role === "admin" ||
        hasRunAssignments),
  );
  const canUploadFailureScreenshot = Boolean(
    activeRun &&
      runHasManual &&
      ["running", "completed"].includes(String(activeRun.status || "")) &&
      (currentUser?.role === "admin" ||
        String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        hasRunAssignments),
  );
  const canControlAutomationRun = Boolean(
    activeRun &&
      runHasAutomation &&
      currentUser &&
      (String(getId(activeRun.startedBy) || "") === String(getId(currentUser) || "") ||
        currentUser.role === "admin"),
  );

  useEffect(() => {
    if (!shouldPollAutomationRun) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(
          `/api/test-runs/${encodeURIComponent(runIdFromUrl)}/my-items`,
          undefined,
        );
        if (cancelled) {
          return;
        }

        if (response.testRun) {
          setSelectedRun((prev) => {
            if (JSON.stringify(prev) !== JSON.stringify(response.testRun)) {
              return response.testRun;
            }
            return prev;
          });
          if (response.testRun.status === "completed") {
            showNotice(formatAutomationRunMessage(summarizeAutomationResults(response.results || [])));
          }
        }
        setMyItems((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(response.results)) {
            return Array.isArray(response.results) ? response.results : [];
          }
          return prev;
        });
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
  }, [runIdFromUrl, shouldPollAutomationRun]);

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
    setStartRunError("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", undefined, {
        method: "POST",
        body: JSON.stringify(resolved.payload),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
        // Reset form after successful creation to avoid stale duplicate-name warning.
        setRunForm({ testPlanId: "", name: "", baseUrl: "" });
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
        const runId = getId(response.testRun);
        if (runId) {
          if (response.automationQueued) {
            setMyItems([]);
            showNotice("Automation đang chạy nền. Kết quả sẽ cập nhật tự động.");
          } else if (response.automationSummary) {
            showNotice(formatAutomationRunMessage(response.automationSummary));
          } else {
            showNotice("Test run started");
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
    const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(`/api/test-runs/${runId}/my-items`, undefined);
    if (response.testRun) setSelectedRun(response.testRun);
    setMyItems(Array.isArray(response.results) ? response.results : []);
  };

  const updateResult = async (resultId: string, status: "pass" | "fail" | "blocked" | "skip", note: string, resultNotes: string) => {
    if (!selectedRun) return;
    try {
      await apiRequest(`/api/test-runs/${getId(selectedRun)}/results/${resultId}`, undefined, { method: "PATCH", body: JSON.stringify({ status, note, notes: resultNotes }) });
      await loadMyItems(getId(selectedRun));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to update result", "error");
      throw error;
    }
  };

  const endRun = async (runId: string) => {
    await apiRequest(`/api/test-runs/${runId}/end`, undefined, { method: "PATCH" });
    if (runId) {
      await loadMyItems(runId);
    }
  };

  const cancelAutomationRun = async () => {
    if (!activeRun) return;
    setCancellingRun(true);
    try {
      await apiRequest(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/cancel`, undefined, {
        method: "POST",
      });
      showNotice("Đang dừng automation run...");
      await loadMyItems(getId(activeRun));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to cancel automation run", "error");
    } finally {
      setCancellingRun(false);
    }
  };

  const retryFailedAutomation = async () => {
    if (!activeRun) return;
    setRetryingRun(true);
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        retryCount?: number;
      }>(`/api/test-runs/${encodeURIComponent(getId(activeRun))}/retry-failed`, undefined, {
        method: "POST",
        body: JSON.stringify({
          baseUrl: runForm.baseUrl || activeRun.automationBaseUrl || "",
        }),
      });
      if (response.testRun) {
        setSelectedRun(response.testRun);
      }
      showNotice(`Đang retry ${response.retryCount ?? 0} case fail...`);
      await loadMyItems(getId(activeRun));
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to retry failed cases", "error");
    } finally {
      setRetryingRun(false);
    }
  };

  const handleExportRun = createExportRunHandler(setExportingRun, showNotice);

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
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <ExecutionScreen
          runForm={runForm}
          setRunForm={setRunForm}
          startRun={startRun}
          startingRun={startingRun}
          scopedPlans={scopedPlans}
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
          canEndSelectedRun={canEndSelectedRun}
          canUploadFailureScreenshot={canUploadFailureScreenshot}
          canControlAutomationRun={canControlAutomationRun}
          cancellingRun={cancellingRun}
          retryingRun={retryingRun}
          onCancelAutomationRun={cancelAutomationRun}
          onRetryFailedAutomation={retryFailedAutomation}
          onLogBug={openJiraBugDialog}
          userName={userName}
          startRunError={startRunError}
          onNotice={showNotice}
          onExportRun={handleExportRun}
          exportingRun={exportingRun}
          onRefreshRunItems={activeRun ? () => loadMyItems(getId(activeRun)) : undefined}
        />
      )}
      {jiraBugDialogNode}
    </>
  );
}
