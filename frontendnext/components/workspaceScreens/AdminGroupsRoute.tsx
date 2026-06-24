"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGroupsScreen from "@/components/workspaceScreens/AdminGroupsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminGroupsRoute() {
  const router = useRouter();
  const { currentUser, selectedProjectId, setTopbar, showNotice } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [groupForm, setGroupForm] = useState({ projectId: "", name: "", description: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [projectsResponse, groupsResponse, testCasesResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups"),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases"),
        ]);
        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(testCasesResponse.testCases) ? testCasesResponse.testCases : []);
      } catch (error) {
        if (!cancelled) showNotice(error instanceof Error ? error.message : "Unable to load groups", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, showNotice]);

  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);
  const scopedProjects = selectedProjectId ? projects.filter((project) => getId(project) === selectedProjectId) : projects;
  const isProjectScoped = Boolean(selectedProjectId);
  const scopedProjectName = scopedProjects[0]?.name || "";

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    setGroupForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
    }));
  }, [selectedProjectId]);

  const refreshGroups = async () => {
    const response = await apiRequest<{ groups: RecordAny[] }>(
      selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups",
      undefined,
    );
    setGroups(Array.isArray(response.groups) ? response.groups : []);
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...groupForm, projectId: groupForm.projectId || selectedProjectId };
      await apiRequest(`/api/test-case-groups${editingGroupId ? `/${editingGroupId}` : ""}`, undefined, {
        method: editingGroupId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      showNotice(editingGroupId ? "Group updated" : "Group created");
      setEditingGroupId("");
      setGroupForm({ projectId: selectedProjectId || "", name: "", description: "" });
      await refreshGroups();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save group", "error");
    }
  };

  const startGroupEdit = (group: RecordAny) => {
    setEditingGroupId(getId(group));
    setGroupForm({ projectId: getId(group.project), name: group.name || "", description: group.description || "" });
  };

  const cancelGroupEdit = () => {
    setEditingGroupId("");
    setGroupForm({ projectId: selectedProjectId || "", name: "", description: "" });
  };

  const deleteGroup = async (groupId: string) => {
    await apiRequest(`/api/test-case-groups/${groupId}`, undefined, { method: "DELETE" });
    await refreshGroups();
  };

  const startTestCaseEdit = (testCase: RecordAny) => {
    router.push(`/workspace/admin/test-cases?caseId=${encodeURIComponent(getId(testCase))}`);
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Groups</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter groups..."
          />
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [searchTerm, setTopbar]);

  return (
    <>
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
          searchTerm={searchTerm}
          isProjectScoped={isProjectScoped}
          scopedProjectName={scopedProjectName}
        />
      )}
    </>
  );
}
