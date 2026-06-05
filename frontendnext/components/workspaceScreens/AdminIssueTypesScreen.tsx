"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { Button, DataTable, Field, INPUT_CLS, SectionCard } from "./shared";
import { getId } from "@/lib/api";

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
    <div className="space-y-5">
      <SectionCard title="Issue Types" subtitle="Manage Jira issue types (global)">
        <form className="space-y-4" onSubmit={createIssueType}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={issueTypeForm.name}
                onChange={(e) => setIssueTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Jira ID">
              <input
                className={INPUT_CLS}
                value={issueTypeForm.idjira}
                onChange={(e) => setIssueTypeForm((prev) => ({ ...prev, idjira: e.target.value }))}
                required
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary">
              {isEditing ? "💾 Update issue type" : "＋ Create issue type"}
            </Button>
            {isEditing && (
              <Button type="button" variant="secondary" onClick={cancelIssueTypeEdit}>
                ↩ Cancel
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Issue Type List">
        <DataTable
          columns={["Name", "Jira ID", "Actions"]}
          rows={issueTypes
            .filter((it: RecordAny) => matchesSearch(it.name, it.idjira))
            .map((it: RecordAny) => (
              <>
                <div>{it.name}</div>
                <div>{it.idjira}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => startIssueTypeEdit(it)}>✎ Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteIssueType(getId(it))}>🗑 Delete</Button>
                </div>
              </>
            ))}
          emptyText="No issue types"
        />
      </SectionCard>
    </div>
  );
}
