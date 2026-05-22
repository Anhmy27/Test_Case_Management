"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  newUserForm: { name: string; email: string; password: string; role: string };
  setNewUserForm: Dispatch<SetStateAction<{ name: string; email: string; password: string; role: string }>>;
  createUser: (event: React.FormEvent) => Promise<void>;
  users: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminUsersScreen({ newUserForm, setNewUserForm, createUser, users, matchesSearch }: Props) {
  return (
    <div className="workspace-stack">
      <SectionCard title="Users" subtitle="Quan ly user, role va assign">
        <form className="workspace-form" onSubmit={createUser}>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Name</span><input value={newUserForm.name} onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))} required /></label>
            <label><span>Email</span><input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))} required /></label>
          </div>
          <div className="workspace-form__grid workspace-form__grid--two">
            <label><span>Password</span><input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))} required /></label>
            <label><span>Role</span><select value={newUserForm.role} onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value }))}><option value="employee">employee</option><option value="admin">admin</option></select></label>
          </div>
          <button className="workspace-primary" type="submit">Create user</button>
        </form>
      </SectionCard>

      <SectionCard title="User List">
        <DataTable columns={["User", "Email", "Role"]} rows={users.filter((user: RecordAny) => matchesSearch(user.name, user.email, user.role)).map((user: RecordAny) => <><div>{user.name}</div><div>{user.email}</div><div>{user.role}</div></>)} emptyText="No users" />
      </SectionCard>
    </div>
  );
}