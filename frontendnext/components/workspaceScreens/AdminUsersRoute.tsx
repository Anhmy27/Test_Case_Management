"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import AdminUsersScreen from "@/components/workspaceScreens/AdminUsersScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminUsersRoute() {
  const { token, currentUser, setTopbar, handleLogout } = useAdminWorkspace();
  const [users, setUsers] = useState<RecordAny[]>([]);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "", role: "employee", isActive: true });
  const [editingUserId, setEditingUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
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
        const response = await apiRequest<{ users: RecordAny[] }>(
          `/api/users?status=${encodeURIComponent(statusFilter)}`,
          token,
        );
        if (cancelled) return;
        setUsers(Array.isArray(response.users) ? response.users : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, statusFilter, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) =>
    !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save user");
    }
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

  const deleteUser = async (userId: string) => {
    await apiRequest(`/api/users/${userId}`, token, { method: "DELETE" });
    await refreshUsers();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Users</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Filter users"
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
  }, [handleLogout, searchTerm, setTopbar, statusFilter]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminUsersScreen
          newUserForm={newUserForm}
          setNewUserForm={setNewUserForm}
          createUser={createUser}
          editingUserId={editingUserId}
          startUserEdit={startUserEdit}
          cancelUserEdit={cancelUserEdit}
          deleteUser={deleteUser}
          users={users}
          matchesSearch={matchesSearch}
          currentUserId={getId(currentUser)}
        />
      )}
    </>
  );
}
