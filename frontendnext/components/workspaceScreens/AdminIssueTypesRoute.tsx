"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminIssueTypesScreen from "@/components/workspaceScreens/AdminIssueTypesScreen";
import { apiRequest, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;

function storedToken() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || ""; }
function storedProject() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || ""; }

export default function AdminIssueTypesRoute() {
  const router = useRouter();
  const [selectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "issue-types", router);
  const [token] = useState<string>(() => storedToken());
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [issueTypes, setIssueTypes] = useState<RecordAny[]>([]);
  const [issueTypeForm, setIssueTypeForm] = useState({ name: "", idjira: "" });
  const [editingIssueTypeId, setEditingIssueTypeId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { router.replace("/"); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true); setMessage("");
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        if (!me.user) { router.replace("/"); return; }
        if (me.user.role !== "admin") { router.replace("/workspace/employee/my-test-plans"); return; }
        const response = await apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types", token);
        if (cancelled) return;
        setCurrentUser(me.user);
        setIssueTypes(Array.isArray(response.issueTypes) ? response.issueTypes : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load issue types");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) => !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const refreshIssueTypes = async () => { const response = await apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types", token); setIssueTypes(Array.isArray(response.issueTypes) ? response.issueTypes : []); };
  const createIssueType = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingIssueTypeId) {
        await apiRequest(`/api/issue-types/${editingIssueTypeId}`, token, { method: "PUT", body: JSON.stringify(issueTypeForm) });
        setMessage("Issue type updated");
      } else {
        await apiRequest(`/api/issue-types`, token, { method: "POST", body: JSON.stringify(issueTypeForm) });
        setMessage("Issue type created");
      }
      setEditingIssueTypeId("");
      setIssueTypeForm({ name: "", idjira: "" });
      await refreshIssueTypes();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save issue type"); }
  };
  const startIssueTypeEdit = (issueType: RecordAny) => { setEditingIssueTypeId(getId(issueType)); setIssueTypeForm({ name: issueType.name || "", idjira: issueType.idjira || "" }); };
  const cancelIssueTypeEdit = () => { setEditingIssueTypeId(""); setIssueTypeForm({ name: "", idjira: "" }); };
  const deleteIssueType = async (issueTypeId: string) => { await apiRequest(`/api/issue-types/${issueTypeId}`, token, { method: "DELETE" }); await refreshIssueTypes(); };
  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Issue Types</div><div className="text-xs text-slate-500">Route-local issue type CRUD</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" placeholder="Filter issue types" /><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading issue types...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="issue-types" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminIssueTypesScreen issueTypeForm={issueTypeForm} setIssueTypeForm={setIssueTypeForm} createIssueType={createIssueType} editingIssueTypeId={editingIssueTypeId} startIssueTypeEdit={startIssueTypeEdit} cancelIssueTypeEdit={cancelIssueTypeEdit} deleteIssueType={deleteIssueType} issueTypes={issueTypes} matchesSearch={matchesSearch} /></AppShell>;
}