"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AdminTestCasesDetailScreen from "@/components/workspaceScreens/AdminTestCasesDetailScreen";
import { apiRequest, createTextMatcher, getId, userName } from "@/lib/api";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";

type RecordAny = Record<string, any>;

function storedToken() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_token") || "";
}

function storedProject() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem("tcm_selected_project_id") || "";
}

export default function AdminTestCasesDetailRoute() {
  const router = useRouter();
  const [token] = useState<string>(() => storedToken());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => storedProject());
  const navItems = useAdminSidebarNav(selectedProjectId, "test-cases-detail", router);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [groups, setGroups] = useState<RecordAny[]>([]);
  const [detailGroupId, setDetailGroupId] = useState("");
  const [detailRows, setDetailRows] = useState<RecordAny[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedProjectId) {
        window.localStorage.setItem("tcm_selected_project_id", selectedProjectId);
      } else {
        window.localStorage.removeItem("tcm_selected_project_id");
      }
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setMessage("");

      try {
        const meResponse = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        const me = meResponse.user;

        if (!me) {
          router.replace("/");
          return;
        }

        if (me.role !== "admin") {
          router.replace("/workspace/employee/my-test-plans");
          return;
        }

        const [projectsResponse, groupsResponse, detailResponse] = await Promise.all([
          apiRequest<{ projects: RecordAny[] }>("/api/projects", token),
          apiRequest<{ groups: RecordAny[] }>(selectedProjectId ? `/api/test-case-groups?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/test-case-groups", token),
          apiRequest<{ testCases: RecordAny[] }>(selectedProjectId ? `/api/test-cases/detail?projectId=${encodeURIComponent(selectedProjectId)}${detailGroupId ? `&groupId=${encodeURIComponent(detailGroupId)}` : ""}` : "/api/test-cases/detail", token),
        ]);

        if (cancelled) return;

        setCurrentUser(me);
        setProjects(Array.isArray(projectsResponse.projects) ? projectsResponse.projects : []);
        setGroups(Array.isArray(groupsResponse.groups) ? groupsResponse.groups : []);
        setDetailRows(Array.isArray(detailResponse.testCases) ? detailResponse.testCases : []);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load test case detail");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [detailGroupId, router, selectedProjectId, token]);

  const handleNavigate = (tab: string) => router.push(`/workspace/admin/${tab}`);
  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tcm_token");
      window.localStorage.removeItem("tcm_selected_project_id");
    }
    router.replace("/");
  };

  const topbar = (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">Test Cases Detail</div>
        <div className="text-xs text-slate-500">Route-local history view</div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={getId(project)} value={getId(project)}>{project.name}</option>
          ))}
        </select>
        <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Log out</button>
      </div>
    </div>
  );

  if (loading && !currentUser) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">Loading test case detail...</div>;
  }

  if (!currentUser) {
    return null;
  }

  return (
    <AppShell
      brand={{ title: "Test Case Management", subtitle: "Admin workspace" }}
      user={{ name: userName(currentUser), email: currentUser.email, role: currentUser.role }}
      navItems={navItems}
      activeKey="test-cases-detail"
      onNavChange={handleNavigate}
      topbar={topbar}
    >
      {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div> : null}
      <AdminTestCasesDetailScreen
        selectedProjectId={selectedProjectId}
        detailGroupId={detailGroupId}
        setDetailGroupId={setDetailGroupId}
        scopedGroups={groups}
        detailLoading={loading}
        detailRows={detailRows}
        matchesSearch={createTextMatcher()}
      />
    </AppShell>
  );
}
