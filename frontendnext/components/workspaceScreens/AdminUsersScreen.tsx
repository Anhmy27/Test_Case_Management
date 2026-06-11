"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { Button, DataTable, Field, INPUT_CLS, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;
type AdminUserFormState = {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  jiraUsername: string;
  jiraPassword: string;
};

type Props = {
  newUserForm: AdminUserFormState;
  setNewUserForm: Dispatch<SetStateAction<AdminUserFormState>>;
  createUser: (event: React.FormEvent) => Promise<void>;
  editingUserId: string;
  startUserEdit: (user: RecordAny) => void;
  cancelUserEdit: () => void;
  deleteUser: (userId: string) => Promise<void>;
  users: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  currentUserId: string;
};

export default function AdminUsersScreen({
  newUserForm,
  setNewUserForm,
  createUser,
  editingUserId,
  startUserEdit,
  cancelUserEdit,
  deleteUser,
  users,
  matchesSearch,
  currentUserId,
}: Props) {
  const isEditing = Boolean(editingUserId);

  return (
    <div className="space-y-5">
      <SectionCard title="Users" subtitle="Quản lý user, role và assign">
        <form className="space-y-4" onSubmit={createUser}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={newUserForm.name}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={INPUT_CLS}
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className={INPUT_CLS}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                required={!isEditing}
                placeholder={isEditing ? "Leave blank to keep current" : undefined}
              />
              <p className="mt-1 text-xs text-slate-500">
                Password must be at least 6 characters.
              </p>
            </Field>
            <Field label="Role">
              <select
                className={INPUT_CLS}
                value={newUserForm.role}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className={INPUT_CLS}
                value={newUserForm.isActive ? "active" : "inactive"}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, isActive: e.target.value === "active" }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Jira Username">
              <input
                className={INPUT_CLS}
                value={newUserForm.jiraUsername}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, jiraUsername: e.target.value }))}
                placeholder="Optional: Jira account username"
              />
            </Field>
            <Field label="Jira Password">
              <input
                type="password"
                className={INPUT_CLS}
                value={newUserForm.jiraPassword}
                onChange={(e) => setNewUserForm((prev) => ({ ...prev, jiraPassword: e.target.value }))}
                placeholder={isEditing ? "Leave blank to keep current Jira password" : "Optional Jira password"}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary">
              {isEditing ? "💾 Update user" : "＋ Create user"}
            </Button>
            {isEditing && (
              <Button type="button" variant="secondary" onClick={cancelUserEdit}>
                ↩ Cancel
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="User List">
        <DataTable
          columns={["User", "Email", "Role", "Status", "Actions"]}
          rows={users
            .filter((user: RecordAny) =>
              matchesSearch(user.name, user.email, user.role, user.isActive === false ? "inactive" : "active"),
            )
            .map((user: RecordAny) => (
              <>
                <div className="font-medium text-slate-900">{user.name}</div>
                <div className="text-slate-600">{user.email}</div>
                <div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {user.role}
                  </span>
                </div>
                <div>
                  <span
                    className={
                      user.isActive === false
                        ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                        : "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                    }
                  >
                    {user.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => startUserEdit(user)}>✎ Edit</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void deleteUser(getId(user))}
                    disabled={getId(user) === currentUserId}
                  >
                    ⛔ Deactivate
                  </Button>
                </div>
              </>
            ))}
          emptyText="No users"
        />
      </SectionCard>
    </div>
  );
}
