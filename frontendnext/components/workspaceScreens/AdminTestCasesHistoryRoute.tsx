"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import AdminTestCasesHistoryScreen from "@/components/workspaceScreens/AdminTestCasesHistoryScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminTestCasesHistoryRoute() {
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [detailGroupId, setDetailGroupId] = useState("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
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
        const [projectsResponse, groupsResponse, detailResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(
            selectedProjectId
              ? `/api/test-cases/history?projectId=${encodeURIComponent(selectedProjectId)}${detailGroupId ? `&groupId=${encodeURIComponent(detailGroupId)}` : ""}`
              : "/api/test-cases/history",
            token,
          ),
        ]);

        if (cancelled) return;

        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setDetailRows(Array.isArray(detailResponse.testCases) ? detailResponse.testCases : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load execution history");
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
  }, [currentUser, detailGroupId, selectedProjectId, token]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Execution History</h1>
        <div className="ml-auto">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none"
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
          matchesSearch={createTextMatcher()}
        />
      )}
    </>
  );
}
