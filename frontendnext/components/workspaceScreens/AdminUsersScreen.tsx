"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { ActionButton, DataTable, SectionCard } from "./shared";
import { getId } from "@/lib/api";

type RecordAny = Record<string, any>;

type Props = {
  newUserForm: { name: string; email: string; password: string; role: string; isActive: boolean };
  setNewUserForm: Dispatch<SetStateAction<{ name: string; email: string; password: string; role: string; isActive: boolean }>>;
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
    <div className="workspace-stack">
      <SectionCard title="Users" subtitle="Quan ly user, role va assign">
        <form className="workspace-form" onSubmit={createUser}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Name</span><input value={newUserForm.name} onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))} required /></label>
            <label><span>Email</span><input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))} required /></label>
          </div>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Password</span><input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))} required={!isEditing} placeholder={isEditing ? "Leave blank to keep current password" : undefined} /></label>
            <label><span>Role</span><select value={newUserForm.role} onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value }))}><option value="employee">employee</option><option value="admin">admin</option></select></label>
          </div>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Status</span><select value={newUserForm.isActive ? "active" : "inactive"} onChange={(e) => setNewUserForm((prev) => ({ ...prev, isActive: e.target.value === "active" }))}><option value="active">active</option><option value="inactive">inactive</option></select></label>
          </div>
          <div className="workspace-inline-actions">
            <ActionButton type="submit" label={isEditing ? "Update user" : "Create user"} icon={isEditing ? "💾" : "＋"} variant="primary" />
            {isEditing && <ActionButton label="Cancel" icon="↩" onClick={cancelUserEdit} tooltip="Cancel editing" />}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="User List">
        <DataTable
          columns={["User", "Email", "Role", "Status", "Actions"]}
          rows={users
            .filter((user: RecordAny) => matchesSearch(user.name, user.email, user.role, user.isActive === false ? "inactive" : "active"))
            .map((user: RecordAny) => (
              <>
                <div>{user.name}</div>
                <div>{user.email}</div>
                <div>{user.role}</div>
                <div>{user.isActive === false ? "inactive" : "active"}</div>
                <div className="workspace-inline-actions">
                  <ActionButton label="Edit" icon="✎" onClick={() => startUserEdit(user)} />
                  <ActionButton
                    label="Deactivate"
                    icon="⛔"
                    variant="danger"
                    onClick={() => void deleteUser(getId(user))}
                    disabled={getId(user) === currentUserId}
                    tooltip={getId(user) === currentUserId ? "You cannot deactivate your own account" : "Deactivate user"}
                  />
                </div>
              </>
            ))}
          emptyText="No users"
        />
      </SectionCard>
    </div>
  );
}