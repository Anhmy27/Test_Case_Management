"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useLayoutEffect, useState } from "react";
import AdminIssueTypesScreen from "@/components/workspaceScreens/AdminIssueTypesScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, getId } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function AdminIssueTypesRoute() {
  const { token, currentUser, setTopbar, handleLogout } = useAdminWorkspace();
  const [issueTypes, setIssueTypes] = useState<RecordAny[]>([]);
  const [issueTypeForm, setIssueTypeForm] = useState({ name: "", idjira: "" });
  const [editingIssueTypeId, setEditingIssueTypeId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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
        const response = await apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types", token);
        if (cancelled) return;
        setIssueTypes(Array.isArray(response.issueTypes) ? response.issueTypes : []);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to load issue types");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser, token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | number | undefined | null>) =>
    !normalizedSearch || values.some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

  const refreshIssueTypes = async () => {
    const response = await apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types", token);
    setIssueTypes(Array.isArray(response.issueTypes) ? response.issueTypes : []);
  };

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save issue type");
    }
  };

  const startIssueTypeEdit = (issueType: RecordAny) => {
    setEditingIssueTypeId(getId(issueType));
    setIssueTypeForm({ name: issueType.name || "", idjira: issueType.idjira || "" });
  };

  const cancelIssueTypeEdit = () => {
    setEditingIssueTypeId("");
    setIssueTypeForm({ name: "", idjira: "" });
  };

  const deleteIssueType = async (issueTypeId: string) => {
    await apiRequest(`/api/issue-types/${issueTypeId}`, token, { method: "DELETE" });
    await refreshIssueTypes();
  };

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Issue Types</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="Filter issue types"
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
  }, [handleLogout, searchTerm, setTopbar]);

  return (
    <>
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <AdminIssueTypesScreen
          issueTypeForm={issueTypeForm}
          setIssueTypeForm={setIssueTypeForm}
          createIssueType={createIssueType}
          editingIssueTypeId={editingIssueTypeId}
          startIssueTypeEdit={startIssueTypeEdit}
          cancelIssueTypeEdit={cancelIssueTypeEdit}
          deleteIssueType={deleteIssueType}
          issueTypes={issueTypes}
          matchesSearch={matchesSearch}
        />
      )}
    </>
  );
}
