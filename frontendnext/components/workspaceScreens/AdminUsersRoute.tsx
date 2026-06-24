"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import AdminUsersScreen from "@/components/workspaceScreens/AdminUsersScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, createTextMatcher, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminUsersRoute() {
  const { currentUser, setTopbar, showNotice } = useAdminWorkspace();
  const [users, setUsers] = useState<RecordAny[]>([]);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    isActive: true,
    jiraUsername: "",
    jiraPassword: "",
  });
  const [editingUserId, setEditingUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ users: RecordAny[] }>(
          `/api/users?status=${encodeURIComponent(statusFilter)}`,
          undefined,
        );
        if (cancelled) return;
        setUsers(Array.isArray(response.users) ? response.users : []);
      } catch (error) {
        if (!cancelled) showNotice(error instanceof Error ? error.message : "Unable to load users", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, statusFilter, showNotice]);

  const matchesSearch = useMemo(() => createTextMatcher(searchTerm), [searchTerm]);

  const refreshUsers = async () => {
    const response = await apiRequest<{ users: RecordAny[] }>(
      `/api/users?status=${encodeURIComponent(statusFilter)}`,
      undefined,
    );
    setUsers(Array.isArray(response.users) ? response.users : []);
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload: RecordAny = { ...newUserForm };
      if (editingUserId && !String(payload.password || "").trim()) {
        delete payload.password;
      }
      if (!String(payload.jiraUsername || "").trim()) {
        delete payload.jiraUsername;
      }
      if (!String(payload.jiraPassword || "").trim()) {
        delete payload.jiraPassword;
      }
      if (editingUserId) {
        await apiRequest(`/api/users/${editingUserId}`, undefined, { method: "PUT", body: JSON.stringify(payload) });
        showNotice("User updated");
      } else {
        await apiRequest(`/api/users`, undefined, { method: "POST", body: JSON.stringify(payload) });
        showNotice("User created");
      }
      setEditingUserId("");
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "employee",
        isActive: true,
        jiraUsername: "",
        jiraPassword: "",
      });
      await refreshUsers();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save user", "error");
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
      jiraUsername: "",
      jiraPassword: "",
    });
  };

  const cancelUserEdit = () => {
    setEditingUserId("");
    setNewUserForm({
      name: "",
      email: "",
      password: "",
      role: "employee",
      isActive: true,
      jiraUsername: "",
      jiraPassword: "",
    });
  };

  const deleteUser = async (userId: string) => {
    await apiRequest(`/api/users/${userId}`, undefined, { method: "DELETE" });
    await refreshUsers();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">Users</h1>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")}
            className={TOPBAR_INPUT_CLS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={`w-52 ${TOPBAR_INPUT_CLS}`}
            placeholder="Filter users..."
          />
        </div>
      </div>,
    );

    return () => setTopbar(null);
  }, [searchTerm, setTopbar, statusFilter]);

  return (
    <>
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
