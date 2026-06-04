"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminUsersScreen from "@/components/workspaceScreens/AdminUsersScreen";
import { apiRequest, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;
function storedToken() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || ""; }
function storedProject() { return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || ""; }

export default function AdminUsersRoute() {
  const router = useRouter();
  const [selectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "users", router);
  const [token] = useState<string>(() => storedToken());
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [users, setUsers] = useState<RecordAny[]>([]);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "", role: "employee", isActive: true });
  const [editingUserId, setEditingUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
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
        const response = await apiRequest<{ users: RecordAny[] }>(
          `/api/users?status=${encodeURIComponent(statusFilter)}`,
          token,
        );
        if (cancelled) return;
        setCurrentUser(me.user);
        setUsers(Array.isArray(response.users) ? response.users : []);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load users"); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [router, statusFilter, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) => !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  const refreshUsers = async () => {
    const response = await apiRequest<{ users: RecordAny[] }>(
      `/api/users?status=${encodeURIComponent(statusFilter)}`,
      token,
    );
    setUsers(Array.isArray(response.users) ? response.users : []);
  };
  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingUserId) {
        await apiRequest(`/api/users/${editingUserId}`, token, { method: "PUT", body: JSON.stringify(newUserForm) });
        setMessage("User updated");
      } else {
        await apiRequest(`/api/users`, token, { method: "POST", body: JSON.stringify(newUserForm) });
        setMessage("User created");
      }
      setEditingUserId("");
      setNewUserForm({ name: "", email: "", password: "", role: "employee", isActive: true });
      await refreshUsers();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save user"); }
  };
  const startUserEdit = (user: RecordAny) => {
    setEditingUserId(getId(user));
    setNewUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role === "admin" ? "admin" : "employee",
      isActive: user.isActive !== false,
    });
  };
  const cancelUserEdit = () => {
    setEditingUserId("");
    setNewUserForm({ name: "", email: "", password: "", role: "employee", isActive: true });
  };
  const deleteUser = async (userId: string) => { await apiRequest(`/api/users/${userId}`, token, { method: "DELETE" }); await refreshUsers(); };
  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => { if (typeof window !== "undefined") { window.localStorage.removeItem("tcm_token"); window.localStorage.removeItem("tcm_selected_project_id"); } router.replace("/"); };
  const topbar = <div className="flex flex-wrap items-center gap-3"><div><div className="text-sm font-semibold text-slate-900">Users</div><div className="text-xs text-slate-500">Route-local user CRUD</div></div><div className="ml-auto flex flex-wrap items-center gap-3"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" placeholder="Filter users" /><button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button></div></div>;
  if (loading && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading users...</div>;
  if (!currentUser) return null;
  return <AppShell brand={{ title: "Test Case Management", subtitle: "Admin workspace" }} user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }} navItems={navItems} activeKey="users" onNavChange={handleNavigate} topbar={topbar}>{message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}<AdminUsersScreen newUserForm={newUserForm} setNewUserForm={setNewUserForm} createUser={createUser} editingUserId={editingUserId} startUserEdit={startUserEdit} cancelUserEdit={cancelUserEdit} deleteUser={deleteUser} users={users} matchesSearch={matchesSearch} currentUserId={getId(currentUser)} /></AppShell>;
}