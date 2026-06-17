"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import AdminAuditLogScreen from "@/components/workspaceScreens/AdminAuditLogScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher } from "@/lib/api";

type RecordAny = Record<string, any>;

const RESOURCE_TYPES = [
  "",
  "user",
  "project",
  "version",
  "issue_type",
  "test_case_group",
  "test_case",
  "test_plan",
  "test_run",
  "jira_issue",
  "jira_profile",
];

export default function AdminAuditLogRoute() {
  const { currentUser, setTopbar } = useAdminWorkspace();
  const [logs, setLogs] = useState<RecordAny[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [searchTerm, setSearchTerm] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (resourceTypeFilter) params.set("resourceType", resourceTypeFilter);

      const response = await apiRequest<{ logs: RecordAny[]; pagination: RecordAny }>(
        `/api/audit-logs?${params.toString()}`,
      );
      setLogs(Array.isArray(response.logs) ? response.logs : []);
      setPagination({
        page: Number(response.pagination?.page || page),
        limit: Number(response.pagination?.limit || 50),
        total: Number(response.pagination?.total || 0),
        pages: Number(response.pagination?.pages || 1),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, resourceTypeFilter, searchTerm]);

  useEffect(() => {
    if (!currentUser) return;
    void loadLogs();
  }, [currentUser, loadLogs]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={TOPBAR_INPUT_CLS}
          placeholder="Search action, user, resource..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
          }}
        />
        <select
          className={TOPBAR_INPUT_CLS}
          value={resourceTypeFilter}
          onChange={(event) => {
            setResourceTypeFilter(event.target.value);
            setPage(1);
          }}
        >
          {RESOURCE_TYPES.map((value) => (
            <option key={value || "all"} value={value}>
              {value ? value.replace(/_/g, " ") : "All resource types"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => void loadLogs()}
        >
          Refresh
        </button>
      </div>,
    );
    return () => setTopbar(null);
  }, [loadLogs, resourceTypeFilter, searchTerm, setTopbar]);

  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);
  const visibleLogs = useMemo(
    () => logs.filter((entry) =>
      matchesSearch(
        entry.action,
        entry.resourceType,
        entry.resourceLabel,
        entry.resourceId,
        entry.userName,
        entry.userEmail,
        entry.clientIp,
      ),
    ),
    [logs, matchesSearch],
  );

  if (loading && logs.length === 0) {
    return <WorkspaceContentSkeleton />;
  }

  return (
    <AdminAuditLogScreen
      logs={visibleLogs}
      message={message}
      pagination={pagination}
      onPageChange={setPage}
    />
  );
}
