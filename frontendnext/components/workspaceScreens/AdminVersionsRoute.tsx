"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminVersionsScreen from "@/components/workspaceScreens/AdminVersionsScreen";
import { apiRequest, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;
function storedToken() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || ""; }
function storedProject() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || ""; }

export default function AdminVersionsRoute() {
  const router = useRouter();
  const [token] = useState<string>(() => storedToken());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "versions", router);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [editingVersionId, setEditingVersionId] = useState("");
  const [versionForm, setVersionForm] = useState({ projectId: "", name: "", idjira: "", releaseDate: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { if (typeof window !== "undefined") { if (selectedProjectId) window.localStorage.setItem("tcm_selected_project_id", selectedProjectId); else window.localStorage.removeItem("tcm_selected_project_id"); } }, [selectedProjectId]);

  useEffect(() => {
    if (!token) { router.replace("/"); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        if (!me.user) { router.replace("/"); return; }
        if (me.user.role !== "admin") { router.replace("/workspace/employee/my-test-plans"); return; }
        const [projectsResponse, versionsResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions", token),
        ]);
        if (cancelled) return;
        setCurrentUser(me.user);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setVersions(Array.isArray(versionsResponse.versions) ? versionsResponse.versions : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load versions"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, selectedProjectId, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) => !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const scopedProjects = selectedProjectId ? projects.filter((project) => getId(project) === selectedProjectId) : projects;
  const refreshVersions = async () => { const response = await apiRequest<{ versions: RecordAny[] }>(selectedProjectId ? `/api/versions?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/versions", token); setVersions(Array.isArray(response.versions) ? response.versions : []); };
  const createVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...versionForm, projectId: versionForm.projectId || selectedProjectId };
      if (editingVersionId) { await apiRequest(`/api/versions/${editingVersionId}`, token, { method: "PUT", body: JSON.stringify(payload) }); setMessage("Version updated"); }
      else { await apiRequest(`/api/versions`, token, { method: "POST", body: JSON.stringify(payload) }); setMessage("Version created"); }
      setEditingVersionId(""); setVersionForm({ projectId: "", name: "", idjira: "", releaseDate: "" }); await refreshVersions();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save version"); }
  };
  const startVersionEdit = (version: RecordAny) => { setEditingVersionId(getId(version)); setVersionForm({ projectId: getId(version.project), name: version.name || "", idjira: version.idjira || "", releaseDate: version.releaseDate ? String(version.releaseDate).slice(0, 10) : "" }); };
  const cancelVersionEdit = () => { setEditingVersionId(""); setVersionForm({ projectId: "", name: "", idjira: "", releaseDate: "" }); };
  const deleteVersion = async (versionId: string) => { await apiRequest(`/api/versions/${versionId}`, token, { method: "DELETE" }); await refreshVersions(); };
  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Versions</div><div className="text-xs text-slate-500">Route-local version CRUD</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" placeholder="Filter versions" /><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="">All projects</option>{projects.map((project) => <option key={getId(project)} value={getId(project)}>{project.name}</option>)}</select><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading versions...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="versions" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminVersionsScreen versionForm={versionForm} setVersionForm={setVersionForm} createVersion={createVersion} editingVersionId={editingVersionId} startVersionEdit={startVersionEdit} cancelVersionEdit={cancelVersionEdit} deleteVersion={deleteVersion} scopedProjects={scopedProjects} versions={versions} projects={projects} matchesSearch={matchesSearch} getId={getId} /></AppShell>;
}