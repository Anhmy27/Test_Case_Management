"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import AdminProjectsScreen from "@/components/workspaceScreens/AdminProjectsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

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
  const { token, currentUser, setTopbar, handleLogout } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string>("");
  const [projectForm, setProjectForm] = useState({ name: "", code: "", pid: "", jiraProjectKey: "", description: "" });
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
        const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects", token);
        if (cancelled) return;
        setProjects(Array.isArray(response.projects) ? response.projects : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) return true;
    return values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  };

  const refreshProjects = async () => {
    const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects", token);
    setProjects(Array.isArray(response.projects) ? response.projects : []);
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...projectForm,
      jiraProjectKey: projectForm.jiraProjectKey.trim(),
    };

    try {
      if (editingProjectId) {
        await apiRequest(`/api/projects/${editingProjectId}`, token, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Project updated");
      } else {
        await apiRequest(`/api/projects`, token, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Project created");
      }
      setEditingProjectId("");
      setProjectForm({ name: "", code: "", pid: "", jiraProjectKey: "", description: "" });
      await refreshProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save project");
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
    await apiRequest(`/api/projects/${projectId}`, token, { method: "DELETE" });
    await refreshProjects();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Projects</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Filter projects"
          />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Log out
          </button>
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [handleLogout, searchTerm, setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
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
