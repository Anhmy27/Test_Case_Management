"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import AdminProjectsScreen from "@/components/workspaceScreens/AdminProjectsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

function getProjectJiraProjectKey(project?: RecordAny | null) {
  return String(
    project?.jiraProjectKey ||
      project?.jiraProductKey ||
      project?.Jiraproduckeys ||
      project?.JiraProductKey ||
      project?.jiraProductKeys ||
      "",
  ).trim();
}

export default function AdminProjectsRoute() {
  const { currentUser, setTopbar, showNotice } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string>("");
  const [projectForm, setProjectForm] = useState({ name: "", code: "", pid: "", jiraProjectKey: "", description: "" });
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
        const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects");
        if (cancelled) return;
        setProjects(Array.isArray(response.projects) ? response.projects : []);
      } catch (error) {
        if (!cancelled) showNotice(error instanceof Error ? error.message : "Unable to load projects", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const refreshProjects = async () => {
    const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects");
    setProjects(Array.isArray(response.projects) ? response.projects : []);
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...projectForm,
      jiraProjectKey: projectForm.jiraProjectKey.trim(),
    };

    try {
      if (editingProjectId) {
        await apiRequest(`/api/projects/${editingProjectId}`, undefined, { method: "PUT", body: JSON.stringify(payload) });
        showNotice("Project updated");
      } else {
        await apiRequest(`/api/projects`, undefined, { method: "POST", body: JSON.stringify(payload) });
        showNotice("Project created");
      }
      setEditingProjectId("");
      setProjectForm({ name: "", code: "", pid: "", jiraProjectKey: "", description: "" });
      await refreshProjects();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save project", "error");
    }
  };

  const startProjectEdit = (project: RecordAny) => {
    setEditingProjectId(getId(project));
    setProjectForm({
      name: project.name || "",
      code: project.code || "",
      pid: project.pid || "",
      jiraProjectKey: getProjectJiraProjectKey(project),
      description: project.description || "",
    });
  };

  const cancelProjectEdit = () => {
    setEditingProjectId("");
    setProjectForm({ name: "", code: "", pid: "", jiraProjectKey: "", description: "" });
  };

  const deleteProject = async (projectId: string) => {
    await apiRequest(`/api/projects/${projectId}`, undefined, { method: "DELETE" });
    await refreshProjects();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Projects</h1>
        <div className="ml-auto">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter projects..."
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
        <AdminProjectsScreen
          editingProjectId={editingProjectId}
          projectForm={projectForm}
          setProjectForm={setProjectForm}
          saveProject={saveProject}
          cancelProjectEdit={cancelProjectEdit}
          projects={projects}
          matchesSearch={matchesSearch}
          startProjectEdit={startProjectEdit}
          deleteProject={deleteProject}
        />
      )}
    </>
  );
}
