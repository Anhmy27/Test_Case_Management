"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminGroupsScreen from "@/components/workspaceScreens/AdminGroupsScreen";
import { apiRequest, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;
function storedToken() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || ""; }
function storedProject() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || ""; }

export default function AdminGroupsRoute() {
  const router = useRouter();
  const [token] = useState<string>(() => storedToken());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "groups", router);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [groupForm, setGroupForm] = useState({ projectId: "", name: "", description: "" });
  const [editingGroupId, setEditingGroupId] = useState("");
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
        const [projectsResponse, groupsResponse, testCasesResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-cases", token),
        ]);
        if (cancelled) return;
        setCurrentUser(me.user);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setTestCases(Array.isArray(testCasesResponse.testCases) ? testCasesResponse.testCases : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load groups"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, selectedProjectId, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) => !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const scopedProjects = selectedProjectId ? projects.filter((project) => getId(project) === selectedProjectId) : projects;
  const refreshGroups = async () => { const response = await apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token); setGroups(Array.isArray(response.groups) ? response.groups : []); };
  const createGroup = async (event: React.FormEvent) => { event.preventDefault(); try { const payload = { ...groupForm, projectId: groupForm.projectId || selectedProjectId }; await apiRequest(`/api/test-case-groups${editingGroupId ? `/${editingGroupId}` : ""}`, token, { method: editingGroupId ? "PUT" : "POST", body: JSON.stringify(payload) }); setMessage(editingGroupId ? "Group updated" : "Group created"); setEditingGroupId(""); setGroupForm({ projectId: "", name: "", description: "" }); await refreshGroups(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save group"); } };
  const startGroupEdit = (group: RecordAny) => { setEditingGroupId(getId(group)); setGroupForm({ projectId: getId(group.project), name: group.name || "", description: group.description || "" }); };
  const cancelGroupEdit = () => { setEditingGroupId(""); setGroupForm({ projectId: "", name: "", description: "" }); };
  const deleteGroup = async (groupId: string) => { await apiRequest(`/api/test-case-groups/${groupId}`, token, { method: "DELETE" }); await refreshGroups(); };
  const startTestCaseEdit = (testCase: RecordAny) => { router.push(`/workspace/admin/test-cases?caseId=${encodeURIComponent(getId(testCase))}`); };
  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Groups</div><div className="text-xs text-slate-500">Route-local group CRUD</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" placeholder="Filter groups" /><select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="">All projects</option>{projects.map((project) => <option key={getId(project)} value={getId(project)}>{project.name}</option>)}</select><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading groups...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="groups" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminGroupsScreen groupForm={groupForm} setGroupForm={setGroupForm} createGroup={createGroup} editingGroupId={editingGroupId} startGroupEdit={startGroupEdit} cancelGroupEdit={cancelGroupEdit} deleteGroup={deleteGroup} scopedProjects={scopedProjects} groups={groups} testCases={testCases} startTestCaseEdit={startTestCaseEdit} matchesSearch={matchesSearch} /></AppShell>;
}