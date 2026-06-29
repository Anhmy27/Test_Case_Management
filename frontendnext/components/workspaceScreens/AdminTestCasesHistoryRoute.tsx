"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminTestCasesHistoryScreen from "@/components/workspaceScreens/AdminTestCasesHistoryScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { useJiraBugDialog } from "@/components/jira/useJiraBugDialog";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminTestCasesHistoryRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseKeyFromUrl = String(searchParams.get("caseKey") || "").trim();
  const { currentUser, selectedProjectId, setTopbar, showNotice } = useAdminWorkspace();
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [detailGroupId, setDetailGroupId] = useState("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { openJiraBugDialog, jiraBugDialogNode } = useJiraBugDialog({
    onNotice: showNotice,
  });

  const openRunResult = (runId: string, resultId: string) => {
    const params = new URLSearchParams({
      runId,
      resultId,
    });
    router.push(`/workspace/admin/test-runs-execution?${params.toString()}`);
  };

  const logBugForResult = async (runId: string, resultId: string) => {
    try {
      const response = await apiRequest<{ testRun?: RecordAny | null; results: RecordAny[] }>(
        `/api/test-runs/${encodeURIComponent(runId)}/my-items`,
        undefined,
      );
      const result = (response.results || []).find((item) => getId(item) === resultId);
      if (!response.testRun || !result) {
        showNotice("Không tìm thấy kết quả run để log bug", "error");
        return;
      }
      await openJiraBugDialog(response.testRun, result);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to load run result for Jira", "error");
    }
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const detailRequest = selectedProjectId
          ? apiRequest<{ testCases: RecordAny[] }>(
              `/api/test-cases/history?projectId=${encodeURIComponent(selectedProjectId)}${detailGroupId ? `&groupId=${encodeURIComponent(detailGroupId)}` : ""}`,
              undefined,
            )
          : Promise.resolve<{ testCases: RecordAny[] }>({ testCases: [] });

        const [groupsResponse, detailResponse] = await Promise.all([
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups"),
          detailRequest,
        ]);

        if (cancelled) return;

        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setDetailRows(Array.isArray(detailResponse.testCases) ? detailResponse.testCases : []);
      } catch (error) {
        if (!cancelled) {
          showNotice(error instanceof Error ? error.message : "Unable to load execution history", "error");
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
  }, [currentUser, detailGroupId, selectedProjectId, showNotice]);

  useEffect(() => {
    if (!currentUser || selectedProjectId || loading) {
      return;
    }
    showNotice("Select a project to view execution history.", "info");
  }, [currentUser, loading, selectedProjectId, showNotice]);

  useEffect(() => {
    if (caseKeyFromUrl) {
      setSearchTerm(caseKeyFromUrl);
    }
  }, [caseKeyFromUrl]);

  const matchesSearch = useMemo(
    () => createTextMatcher(searchTerm),
    [searchTerm],
  );

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Execution History</h1>
        {caseKeyFromUrl ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:text-indigo-300">
            Filter: {caseKeyFromUrl}
          </span>
        ) : null}
      </div>,
    );

    return () => setTopbar(null);
  }, [caseKeyFromUrl, setTopbar]);

  return (
    <>
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminTestCasesHistoryScreen
          selectedProjectId={selectedProjectId}
          detailGroupId={detailGroupId}
          setDetailGroupId={setDetailGroupId}
          scopedGroups={groups}
          detailLoading={loading}
          detailRows={detailRows}
          highlightCaseKey={caseKeyFromUrl}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          matchesSearch={matchesSearch}
          onOpenRunResult={openRunResult}
          onLogBugForResult={logBugForResult}
        />
      )}
      {jiraBugDialogNode}
    </>
  );
}
