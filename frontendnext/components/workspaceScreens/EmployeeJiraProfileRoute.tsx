"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { useEmployeeWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { apiRequest } from "@/lib/api";

type JiraProfile = {
  jiraUsername?: string;
  hasPassword?: boolean;
  hasSession?: boolean;
  sessionExpiresAt?: string | null;
  lastVerifiedAt?: string | null;
};

export default function EmployeeJiraProfileRoute() {
  const { currentUser, setTopbar, showNotice } = useEmployeeWorkspace();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<JiraProfile | null>(null);
  const [jiraUsername, setJiraUsername] = useState("");
  const [jiraPassword, setJiraPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex min-h-[40px] items-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Workspace
          </div>
          <div className="text-xl font-semibold text-slate-900">Jira Profile</div>
          <div className="text-xs text-slate-500">
            Configure Jira credentials for your account. If empty, system uses admin fallback credentials.
          </div>
        </div>
      </div>,
    );
    return () => setTopbar(null);
  }, [setTopbar]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const response = await apiRequest<{ profile: JiraProfile | null }>("/api/jira/profile");
        if (cancelled) return;
        setProfile(response.profile || null);
        setJiraUsername(String(response.profile?.jiraUsername || ""));
      } catch (error) {
        if (!cancelled) {
          showNotice(error instanceof Error ? error.message : "Unable to load Jira profile", "error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiRequest<{ profile: JiraProfile | null }>(
        "/api/jira/profile",
        undefined,
        {
          method: "PUT",
          body: JSON.stringify({
            jiraUsername,
            jiraPassword,
          }),
        },
      );
      setProfile(response.profile || null);
      setJiraPassword("");
      showNotice("Saved Jira profile successfully.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to save Jira profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <WorkspaceContentSkeleton />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Jira Username
                </label>
                <input
                  type="text"
                  value={jiraUsername}
                  onChange={(event) => setJiraUsername(event.target.value)}
                  placeholder="your.jira.username"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Jira Password
                </label>
                <input
                  type="password"
                  value={jiraPassword}
                  onChange={(event) => setJiraPassword(event.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
            <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-3">
              <div>
                <span className="font-semibold text-slate-700">Has Password:</span>{" "}
                {profile?.hasPassword ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Has Session:</span>{" "}
                {profile?.hasSession ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Last Verified:</span>{" "}
                {formatDate(profile?.lastVerifiedAt)}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Session expires at: <span className="font-medium text-slate-700">{formatDate(profile?.sessionExpiresAt)}</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Jira Profile"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
