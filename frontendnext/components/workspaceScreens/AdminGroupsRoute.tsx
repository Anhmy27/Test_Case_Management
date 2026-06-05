"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGroupsScreen from "@/components/workspaceScreens/AdminGroupsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminGroupsRoute() {
  const router = useRouter();
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [groupForm, setGroupForm] = useState({ projectId: "", name: "", description: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
        const [projectsResponse, groupsResponse, testCasesResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
        ]);
        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(testCasesResponse.testCases) ? testCasesResponse.testCases : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) =>
    !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const scopedProjects = selectedProjectId ? projects.filter((project) => getId(project) === selectedProjectId) : projects;

  const refreshGroups = async () => {
    const response = await apiRequest<{ groups: RecordAny[] }>(
      selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups",
      token,
    );
    setGroups(Array.isArray(response.groups) ? response.groups : []);
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...groupForm, projectId: groupForm.projectId || selectedProjectId };
      await apiRequest(`/api/test-case-groups${editingGroupId ? `/${editingGroupId}` : ""}`, token, {
        method: editingGroupId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(editingGroupId ? "Group updated" : "Group created");
      setEditingGroupId("");
      setGroupForm({ projectId: "", name: "", description: "" });
      await refreshGroups();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save group");
    }
  };

  const startGroupEdit = (group: RecordAny) => {
    setEditingGroupId(getId(group));
    setGroupForm({ projectId: getId(group.project), name: group.name || "", description: group.description || "" });
  };

  const cancelGroupEdit = () => {
    setEditingGroupId("");
    setGroupForm({ projectId: "", name: "", description: "" });
  };

  const deleteGroup = async (groupId: string) => {
    await apiRequest(`/api/test-case-groups/${groupId}`, token, { method: "DELETE" });
    await refreshGroups();
  };

  const startTestCaseEdit = (testCase: RecordAny) => {
    router.push(`/workspace/admin/test-cases?caseId=${encodeURIComponent(getId(testCase))}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Groups</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            placeholder="Filter groups..."
          />
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
  }, [projects, searchTerm, selectedProjectId, setSelectedProjectId, setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminGroupsScreen
          groupForm={groupForm}
          setGroupForm={setGroupForm}
          createGroup={createGroup}
          editingGroupId={editingGroupId}
          startGroupEdit={startGroupEdit}
          cancelGroupEdit={cancelGroupEdit}
          deleteGroup={deleteGroup}
          scopedProjects={scopedProjects}
          groups={groups}
          testCases={testCases}
          startTestCaseEdit={startTestCaseEdit}
          matchesSearch={matchesSearch}
        />
      )}
    </>
  );
}
