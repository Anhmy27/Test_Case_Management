"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminTestRunsScreen from "@/components/workspaceScreens/AdminTestRunsScreen";
import { apiRequest, formatAutomationRunMessage, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;
function storedToken() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || ""; }
function storedProject() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || ""; }

export default function AdminTestRunsRoute() {
  const router = useRouter();
  const [selectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "test-runs", router);
  const [token] = useState<string>(() => storedToken());
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "", baseUrl: "" });
  const [loading, setLoading] = useState(true);
  const [startingRun, setStartingRun] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { router.replace("/"); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        if (!me.user) { router.replace("/"); return; }
        if (me.user.role !== "admin") { router.replace("/workspace/employee/my-test-plans"); return; }
        const [plansResponse, runsResponse] = await Promise.all([
          apiRequest<{ testPlans: RecordAny[] }>(selectedProjectId ? `/api/test-plans?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-plans", token),
          apiRequest<{ testRuns: RecordAny[] }>(selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs", token),
        ]);
        if (cancelled) return;
        setCurrentUser(me.user);
        setPlans(Array.isArray(plansResponse.testPlans) ? plansResponse.testPlans : []);
        setRuns(Array.isArray(runsResponse.testRuns) ? runsResponse.testRuns : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load test runs"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, selectedProjectId, token]);

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
    const response = await apiRequest<{ testRuns: RecordAny[] }>(selectedProjectId ? `/api/test-runs?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-runs", token);
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
        automationSummary?: RecordAny;
      }>("/api/test-runs", token, { method: "POST", body: JSON.stringify(runForm) });
      if (response.testRun) {
        setRuns((prev) => [response.testRun as RecordAny, ...prev.filter((run) => getId(run) !== getId(response.testRun))]);
      }
      await refreshRuns();
      if (response.automationSummary) {
        setMessage(formatAutomationRunMessage(response.automationSummary));
      } else {
        setMessage("Test run started");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start test run");
    } finally {
      setStartingRun(false);
    }
  };

  const loadMyItems = async (runId: string) => {
    router.push(`/workspace/admin/execution?runId=${encodeURIComponent(runId)}`);
  };

  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Test Runs</div><div className="text-xs text-slate-500">Route-local test run list</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading test runs...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="test-runs" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminTestRunsScreen runForm={runForm} setRunForm={setRunForm} startRun={startRun} startingRun={startingRun} scopedPlans={scopedPlans} selectedRunPlanIsAutomation={selectedRunPlanIsAutomation} adminRuns={runs} matchesSearch={matchesSearch} userName={userName} currentUserId={currentUserId} loadMyItems={loadMyItems} /></AppShell>;
}