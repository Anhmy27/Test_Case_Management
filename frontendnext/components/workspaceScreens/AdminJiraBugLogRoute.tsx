"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRunDocumentId } from "@/components/jira/jiraBugUtils";
import AdminJiraBugLogScreen from "@/components/workspaceScreens/AdminJiraBugLogScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

function getIssueTypeOptionValue(issueType: RecordAny) {
  return String(issueType.idjira || getId(issueType) || "").trim();
}

export default function AdminJiraBugLogRoute() {
  const router = useRouter();
  const { currentUser, selectedProjectId, projects, setTopbar, showNotice } = useAdminWorkspace();
  const scopedProjectName = useMemo(() => {
    const project = projects.find((item) => getId(item) === selectedProjectId);
    return project?.name || "";
  }, [projects, selectedProjectId]);
  const [logBugs, setLogBugs] = useState<RecordAny[]>([]);
  const [issueTypes, setIssueTypes] = useState<RecordAny[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;

    void apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types")
      .then((response) => {
        if (cancelled) {
          return;
        }
        const items = Array.isArray(response.issueTypes) ? response.issueTypes : [];
        setIssueTypes(
          items.filter((issueType) => {
            const value = getIssueTypeOptionValue(issueType);
            const name = String(issueType.name || "").trim();
            return Boolean(value && name);
          }),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setIssueTypes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const loadLogBugs = useCallback(async () => {
    if (!selectedProjectId) {
      setLogBugs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("projectId", selectedProjectId);
      params.set("page", String(page));
      params.set("limit", "50");
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }
      if (priorityFilter.trim()) {
        params.set("priority", priorityFilter.trim());
      }
      if (issueTypeFilter.trim()) {
        params.set("issueType", issueTypeFilter.trim());
      }

      const response = await apiRequest<{ logBugs: RecordAny[]; pagination: RecordAny }>(
        `/api/jira/log-bugs?${params.toString()}`,
      );
      setLogBugs(Array.isArray(response.logBugs) ? response.logBugs : []);
      setPagination({
        page: Number(response.pagination?.page || page),
        limit: Number(response.pagination?.limit || 50),
        total: Number(response.pagination?.total || 0),
        pages: Number(response.pagination?.pages || 1),
      });
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to load Jira bug history", "error");
      setLogBugs([]);
    } finally {
      setLoading(false);
    }
  }, [issueTypeFilter, page, priorityFilter, searchTerm, selectedProjectId, showNotice]);

  useEffect(() => {
    if (!currentUser || selectedProjectId) {
      return;
    }
    showNotice("Select a project to view Jira bug history.", "info");
  }, [currentUser, selectedProjectId, showNotice]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    void loadLogBugs();
  }, [currentUser, loadLogBugs]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={TOPBAR_INPUT_CLS}
          placeholder="Search issue key, summary, case..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={TOPBAR_INPUT_CLS}
          value={priorityFilter}
          onChange={(event) => {
            setPriorityFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All priorities</option>
          <option value="1">Priority 1</option>
          <option value="2">Priority 2</option>
          <option value="3">Priority 3</option>
          <option value="4">Priority 4</option>
          <option value="5">Priority 5</option>
        </select>
        <select
          className={TOPBAR_INPUT_CLS}
          value={issueTypeFilter}
          onChange={(event) => {
            setIssueTypeFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All issue types</option>
          {issueTypes.map((issueType) => {
            const optionValue = getIssueTypeOptionValue(issueType);
            return (
              <option key={getId(issueType) || optionValue} value={optionValue}>
                {issueType.name}
              </option>
            );
          })}
        </select>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => void loadLogBugs()}
        >
          Refresh
        </button>
      </div>,
    );
    return () => setTopbar(null);
  }, [issueTypeFilter, issueTypes, loadLogBugs, priorityFilter, searchTerm, setTopbar]);

  if (loading && logBugs.length === 0) {
    return <WorkspaceContentSkeleton />;
  }

  return (
    <AdminJiraBugLogScreen
      logBugs={logBugs}
      pagination={pagination}
      onPageChange={setPage}
      scopedProjectName={scopedProjectName}
      onOpenExecution={(entry) => {
        const runId = getRunDocumentId(entry?.testRun);
        if (!runId) {
          return;
        }
        const resultId = String(entry?.runResult || "").trim();
        const params = new URLSearchParams();
        params.set("runId", runId);
        if (resultId) {
          params.set("resultId", resultId);
        }
        router.push(`/workspace/admin/test-runs-execution?${params.toString()}`);
      }}
    />
  );
}
