"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  issueTypeForm: { name: string; idjira: string };
  setIssueTypeForm: Dispatch<SetStateAction<{ name: string; idjira: string }>>;
  createIssueType: (event: React.FormEvent) => Promise<void>;
  editingIssueTypeId: string;
  startIssueTypeEdit: (issueType: RecordAny) => void;
  cancelIssueTypeEdit: () => void;
  deleteIssueType: (issueTypeId: string) => Promise<void>;
  issueTypes: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
};

export default function AdminIssueTypesScreen({
  issueTypeForm,
  setIssueTypeForm,
  createIssueType,
  editingIssueTypeId,
  startIssueTypeEdit,
  cancelIssueTypeEdit,
  deleteIssueType,
  issueTypes,
  matchesSearch,
}: Props) {
  const isEditing = Boolean(editingIssueTypeId);

  return (
    <div className="workspace-stack">
      <SectionCard title="Issue Types" subtitle="Manage Jira issue types (global)">
        <form className="workspace-form" onSubmit={createIssueType}>
          <div className="workspace-form__grid workspace-form__grid--three">
            <label>
              <span>Name</span>
              <input value={issueTypeForm.name} onChange={(e) => setIssueTypeForm((prev) => ({ ...prev, name: e.target.value }))} required />
            </label>
            <label>
              <span>Jira id</span>
              <input value={issueTypeForm.idjira} onChange={(e) => setIssueTypeForm((prev) => ({ ...prev, idjira: e.target.value }))} required />
            </label>
          </div>
          <div className="workspace-inline-actions">
            <button className="workspace-primary" type="submit">{isEditing ? "Update issue type" : "Create issue type"}</button>
            {isEditing && <button type="button" className="workspace-secondary" onClick={cancelIssueTypeEdit}>Cancel</button>}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Issue Type List">
        <DataTable
          columns={["Name", "Jira id", "Actions"]}
          rows={issueTypes
            .filter((it: RecordAny) => matchesSearch(it.name, it.idjira))
            .map((it: RecordAny) => (
              <>
                <div>{it.name}</div>
                <div>{it.idjira}</div>
                <div className="workspace-inline-actions">
                  <button type="button" className="workspace-secondary" onClick={() => startIssueTypeEdit(it)}>
                    Edit
                  </button>
                  <button type="button" className="workspace-danger" onClick={() => void deleteIssueType(it._id)}>
                    Delete
                  </button>
                </div>
              </>
            ))}
          emptyText="No issue types"
        />
      </SectionCard>
    </div>
  );
}
