"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminTestRunsScreen from "@/components/workspaceScreens/AdminTestRunsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, formatAutomationRunMessage, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminTestRunsRoute() {
  const router = useRouter();
  const { token, currentUser, selectedProjectId, setTopbar } = useAdminWorkspace();
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "", baseUrl: "" });
  const [loading, setLoading] = useState(true);
  const [startingRun, setStartingRun] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const [plansResponse, runsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
          apiRequest<{ testRuns: RecordAny[] }>(selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs", token),
        ]);
        if (cancelled) return;
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test runs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, token]);

  const scopedPlans = useMemo(() => plans, [plans]);
  const selectedRunPlan = scopedPlans.find((plan) => getId(plan) === runForm.testPlanId);
  const selectedRunPlanIsAutomation = String(selectedRunPlan?.executionMode || "manual") === "automation";
  const currentUserId = getId(currentUser);
  const matchesSearch = (...values: Array<string | number | undefined | null>) => {
    const query = String(values[0] || "").trim().toLowerCase();
    if (!query) {
      return true;
    }

    return values.slice(1).some((value) => String(value || "").toLowerCase().includes(query));
  };

  const refreshRuns = async () => {
    const response = await apiRequest<{ testRuns: RecordAny[] }>(
      selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs",
      token,
    );
    setRuns(Array.isArray(response.testRuns) ? response.testRuns : []);
  };

  const startRun = async (event: React.FormEvent) => {
    event.preventDefault();
    if (startingRun) return;
    setStartingRun(true);
    setMessage("");
    try {
      const response = await apiRequest<{
        testRun?: RecordAny | null;
        automationQueued?: boolean;
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, { method: "POST", body: JSON.stringify(runForm) });
      if (response.testRun) {
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
        if (response.automationQueued) {
          router.push(`/workspace/admin/execution?runId=${encodeURIComponent(getId(response.testRun))}`);
          setMessage("Automation Ä‘ang cháº¡y ná»n. Káº¿t quáº£ sáº½ cáº­p nháº­t tá»± Ä‘á»™ng.");
        } else if (response.automationSummary) {
          setMessage(formatAutomationRunMessage(response.automationSummary));
        } else {
          setMessage("Test run started");
        }
      }
      await refreshRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start test run");
    } finally {
      setStartingRun(false);
    }
  };

  const loadMyItems = async (runId: string) => {
    router.push(`/workspace/admin/execution?runId=${encodeURIComponent(runId)}`);
  };

  useLayoutEffect(() => {
    setTopbar(<h1 className="text-xl font-semibold text-slate-900">Test Runs</h1>);
    return () => setTopbar(null);
  }, [setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminTestRunsScreen
          runForm={runForm}
          setRunForm={setRunForm}
          startRun={startRun}
          startingRun={startingRun}
          scopedPlans={scopedPlans}
          selectedRunPlanIsAutomation={selectedRunPlanIsAutomation}
          adminRuns={runs}
          matchesSearch={matchesSearch}
          userName={userName}
          currentUserId={currentUserId}
          loadMyItems={loadMyItems}
        />
      )}
    </>
  );
}
