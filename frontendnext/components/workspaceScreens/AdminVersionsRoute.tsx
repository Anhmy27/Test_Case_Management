"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import AdminVersionsScreen from "@/components/workspaceScreens/AdminVersionsScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminVersionsRoute() {
  const { currentUser, selectedProjectId, setTopbar, showNotice } = useAdminWorkspace();
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [editingVersionId, setEditingVersionId] = useState("");
  const [versionForm, setVersionForm] = useState<{ projectId: string; name: string; releaseDate: string }>({ projectId: "", name: "", releaseDate: "" });
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
        const [projectsResponse, versionsResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects"),
          apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions"),
        ]);
        if (cancelled) return;
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setVersions(Array.isArray(versionsResponse.versions) ? versionsResponse.versions : []);
      } catch (error) {
        if (!cancelled) showNotice(error instanceof Error ? error.message : "Unable to load versions", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId]);

  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);
  const scopedProjects = selectedProjectId ? projects.filter((project) => getId(project) === selectedProjectId) : projects;
  const isProjectScoped = Boolean(selectedProjectId);
  const scopedProjectName = scopedProjects[0]?.name || "";

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    setVersionForm((prev) => ({
      ...prev,
      projectId: selectedProjectId,
    }));
  }, [selectedProjectId]);

  const refreshVersions = async () => {
    const response = await apiRequest<{ versions: RecordAny[] }>(
      selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions",
      undefined,
    );
    setVersions(Array.isArray(response.versions) ? response.versions : []);
  };

  const createVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...versionForm, projectId: versionForm.projectId || selectedProjectId };
      if (editingVersionId) {
        await apiRequest(`/api/versions/${editingVersionId}`, undefined, { method: "PUT", body: JSON.stringify(payload) });
        showNotice("Version updated");
      } else {
        await apiRequest(`/api/versions`, undefined, { method: "POST", body: JSON.stringify(payload) });
        showNotice("Version created");
      }
      setEditingVersionId("");
      setVersionForm({ projectId: selectedProjectId || "", name: "", releaseDate: "" });
      await refreshVersions();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save version", "error");
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
    setVersionForm({ projectId: selectedProjectId || "", name: "", releaseDate: "" });
  };

  const deleteVersion = async (versionId: string) => {
    await apiRequest(`/api/versions/${versionId}`, undefined, { method: "DELETE" });
    await refreshVersions();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Versions</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter versions..."
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
          isProjectScoped={isProjectScoped}
          scopedProjectName={scopedProjectName}
        />
      )}
    </>
  );
}
