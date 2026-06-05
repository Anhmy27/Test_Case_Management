"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import AdminVersionsScreen from "@/components/workspaceScreens/AdminVersionsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminVersionsRoute() {
  const { token, currentUser, selectedProjectId, setSelectedProjectId, setTopbar } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [editingVersionId, setEditingVersionId] = useState("");
  const [versionForm, setVersionForm] = useState<{ projectId: string; name: string; releaseDate: string }>({ projectId: "", name: "", releaseDate: "" });
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
        const [projectsResponse, versionsResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions", token),
        ]);
        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setVersions(Array.isArray(versionsResponse.versions) ? versionsResponse.versions : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load versions");
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

  const refreshVersions = async () => {
    const response = await apiRequest<{ versions: RecordAny[] }>(
      selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions",
      token,
    );
    setVersions(Array.isArray(response.versions) ? response.versions : []);
  };

  const createVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...versionForm, projectId: versionForm.projectId || selectedProjectId };
      if (editingVersionId) {
        await apiRequest(`/api/versions/${editingVersionId}`, token, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Version updated");
      } else {
        await apiRequest(`/api/versions`, token, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Version created");
      }
      setEditingVersionId("");
      setVersionForm({ projectId: "", name: "", releaseDate: "" });
      await refreshVersions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save version");
    }
  };

  const startVersionEdit = (version: RecordAny) => {
    setEditingVersionId(getId(version));
    setVersionForm({
      projectId: getId(version.project),
      name: version.name || "",
      releaseDate: version.releaseDate ? String(version.releaseDate).slice(0, 10) : "",
    });
  };

  const cancelVersionEdit = () => {
    setEditingVersionId("");
    setVersionForm({ projectId: "", name: "", releaseDate: "" });
  };

  const deleteVersion = async (versionId: string) => {
    await apiRequest(`/api/versions/${versionId}`, token, { method: "DELETE" });
    await refreshVersions();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Versions</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            placeholder="Filter versions..."
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
        <AdminVersionsScreen
          versionForm={versionForm}
          setVersionForm={setVersionForm}
          createVersion={createVersion}
          editingVersionId={editingVersionId}
          startVersionEdit={startVersionEdit}
          cancelVersionEdit={cancelVersionEdit}
          deleteVersion={deleteVersion}
          scopedProjects={scopedProjects}
          versions={versions}
          projects={projects}
          matchesSearch={matchesSearch}
          getId={getId}
        />
      )}
    </>
  );
}
