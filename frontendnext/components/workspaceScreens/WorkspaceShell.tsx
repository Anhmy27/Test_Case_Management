"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";
import { AdminProjectScopeSelect, composeAdminTopbar } from "@/components/workspaceScreens/adminTopbar";
import { EMPLOYEE_NAV_ITEMS } from "@/components/workspaceScreens/employeeNav";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { WorkspaceNoticeProvider, useWorkspaceNotice, type WorkspaceNoticeVariant } from "@/components/workspaceScreens/WorkspaceNotice";
import { apiRequest, getId, matchesSelectedEntity, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

const ADMIN_PROJECT_STORAGE_KEY = "tcm_admin_selected_project_id";
const LEGACY_PROJECT_STORAGE_KEY = "tcm_selected_project_id";

function readStoredAdminProjectId() {
  if (typeof window === "undefined") {
    return "";
  }

  const storedAdminScope = window.localStorage.getItem(ADMIN_PROJECT_STORAGE_KEY);
  if (storedAdminScope) {
    return storedAdminScope;
  }

  const legacyScope = window.localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY) || "";
  if (legacyScope) {
    window.localStorage.setItem(ADMIN_PROJECT_STORAGE_KEY, legacyScope);
  }
  return legacyScope;
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function useRouteTopbar(pathname: string) {
  const [topbarEntry, setTopbarEntry] = useState<{ path: string; node: ReactNode | null } | null>(null);

  const setTopbar = useCallback((node: ReactNode | null) => {
    setTopbarEntry({ path: pathname, node });
  }, [pathname]);

  const topbar = topbarEntry?.path === pathname ? topbarEntry.node : null;

  return { topbar, setTopbar };
}

type AdminWorkspaceContextValue = {
  currentUser: RecordAny;
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  projects: RecordAny[];
  refreshProjects: () => Promise<RecordAny[]>;
  setTopbar: (node: ReactNode | null) => void;
  showNotice: (message: string, variant?: WorkspaceNoticeVariant) => void;
  handleLogout: () => void;
};

type EmployeeWorkspaceContextValue = {
  currentUser: RecordAny;
  setTopbar: (node: ReactNode | null) => void;
  showNotice: (message: string, variant?: WorkspaceNoticeVariant) => void;
  handleLogout: () => void;
};

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);
const EmployeeWorkspaceContext = createContext<EmployeeWorkspaceContextValue | null>(null);

function resolveAdminActiveKey(pathname: string) {
  const match = pathname.match(/\/workspace\/admin\/([^/?#]+)/);
  const key = match?.[1] || "dashboard";
  if (key === "test-runs" || key === "execution") {
    return "test-runs-execution";
  }
  return key;
}

function resolveEmployeeActiveKey(pathname: string) {
  const match = pathname.match(/\/workspace\/employee\/([^/?#]+)/);
  return match?.[1] || "my-test-plans";
}

export function useAdminWorkspace() {
  const context = useContext(AdminWorkspaceContext);
  if (!context) {
    throw new Error("useAdminWorkspace must be used within AdminWorkspaceShell");
  }
  return context;
}

export function useEmployeeWorkspace() {
  const context = useContext(EmployeeWorkspaceContext);
  if (!context) {
    throw new Error("useEmployeeWorkspace must be used within EmployeeWorkspaceShell");
  }
  return context;
}

export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNoticeProvider>
      <AdminWorkspaceShellInner>{children}</AdminWorkspaceShellInner>
    </WorkspaceNoticeProvider>
  );
}

function AdminWorkspaceShellInner({ children }: { children: ReactNode }) {
  const { showNotice } = useWorkspaceNotice();
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = resolveAdminActiveKey(pathname);
  const mainRef = useRef<HTMLElement | null>(null);
  const isClient = useIsClient();
  const didHydrateScopeRef = useRef(false);
  const [scopeReady, setScopeReady] = useState(false);
  const [selectedProjectId, setSelectedProjectIdState] = useState("");
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { topbar, setTopbar } = useRouteTopbar(pathname);

  const setSelectedProjectId = useCallback((projectId: string) => {
    setSelectedProjectIdState(String(projectId || "").trim());
  }, []);

  const refreshProjects = useCallback(async () => {
    const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects");
    const projectsList = Array.isArray(response.projects) ? response.projects : [];
    setProjects(projectsList);
    return projectsList;
  }, []);

  const navItems = useAdminSidebarNav(selectedProjectId, activeKey, router, {
    enabled: isClient && scopeReady,
  });

  useEffect(() => {
    if (!isClient || didHydrateScopeRef.current) {
      return;
    }
    didHydrateScopeRef.current = true;
    setSelectedProjectId(readStoredAdminProjectId());
    setScopeReady(true);
  }, [isClient, setSelectedProjectId]);

  useEffect(() => {
    if (!isClient || !didHydrateScopeRef.current) {
      return;
    }
    if (selectedProjectId) {
      window.localStorage.setItem(ADMIN_PROJECT_STORAGE_KEY, selectedProjectId);
    } else {
      window.localStorage.removeItem(ADMIN_PROJECT_STORAGE_KEY);
    }
  }, [isClient, selectedProjectId]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let cancelled = false;
    const syncProjects = async () => {
      try {
        const response = await apiRequest<{ projects: RecordAny[] }>("/api/projects");
        if (cancelled) {
          return;
        }

        const projectsList = Array.isArray(response.projects) ? response.projects : [];
        setProjects(projectsList);

        if (!selectedProjectId) {
          return;
        }

        const matchedProject = projectsList.find((project) =>
          matchesSelectedEntity(project, selectedProjectId),
        );
        if (!matchedProject) {
          setSelectedProjectId("");
          return;
        }
        const canonicalProjectId = getId(matchedProject);
        if (canonicalProjectId && canonicalProjectId !== selectedProjectId) {
          setSelectedProjectId(canonicalProjectId);
        }
      } catch {
        // Ignore scope normalization failure; page-level fetch will show API errors if needed.
      }
    };

    void syncProjects();
    return () => {
      cancelled = true;
    };
  }, [currentUser, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    let cancelled = false;
    const loadAuth = async () => {
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me");
        if (!me.user) {
          router.replace("/");
          return;
        }
        if (me.user.role !== "admin") {
          router.replace("/workspace/employee/my-test-plans");
          return;
        }
        if (!cancelled) {
          setCurrentUser(me.user);
        }
      } catch {
        if (!cancelled) {
          router.replace("/");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, [isClient, router]);

  const handleNavigate = (tab: string) => {
    router.push(`/workspace/admin/${tab}`);
  };

  const handleLogout = useCallback(() => {
    void apiRequest("/api/auth/logout", undefined, { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        window.localStorage.removeItem(ADMIN_PROJECT_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY);
        router.replace("/");
      });
  }, [router]);

  const contextValue = useMemo<AdminWorkspaceContextValue | null>(() => {
    if (!currentUser) {
      return null;
    }

    return {
      currentUser,
      selectedProjectId,
      setSelectedProjectId,
      projects,
      refreshProjects,
      setTopbar,
      showNotice,
      handleLogout,
    };
  }, [currentUser, handleLogout, projects, refreshProjects, selectedProjectId, setSelectedProjectId, setTopbar, showNotice]);

  const defaultTopbar = (
    <div className="flex min-h-[40px] items-center">
      <div className="text-xl font-semibold capitalize text-slate-900">
        {activeKey.replace(/-/g, " ")}
      </div>
    </div>
  );

  const scopeSelect = (
    <AdminProjectScopeSelect
      projects={projects}
      selectedProjectId={selectedProjectId}
      onChange={setSelectedProjectId}
    />
  );

  const resolvedTopbar = composeAdminTopbar(topbar ?? defaultTopbar, scopeSelect);

  const shellUser = currentUser
    ? {
        name: userName(currentUser),
        email: currentUser.email,
        role: currentUser.role,
      }
    : { name: "Loading...", email: "", role: "admin" };

  return (
    <AdminWorkspaceContext.Provider value={contextValue}>
      <AppShell
        brand={{ title: "Test Case Management", subtitle: "Admin workspace" }}
        user={shellUser}
        navItems={navItems}
        activeKey={activeKey}
        onNavChange={handleNavigate}
        onLogout={handleLogout}
        topbar={resolvedTopbar}
        mainRef={mainRef}
      >
        {!isClient || !authReady || !currentUser || !contextValue ? (
          <WorkspaceContentSkeleton />
        ) : (
          children
        )}
      </AppShell>
    </AdminWorkspaceContext.Provider>
  );
}

export function EmployeeWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceNoticeProvider>
      <EmployeeWorkspaceShellInner>{children}</EmployeeWorkspaceShellInner>
    </WorkspaceNoticeProvider>
  );
}

function EmployeeWorkspaceShellInner({ children }: { children: ReactNode }) {
  const { showNotice } = useWorkspaceNotice();
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = resolveEmployeeActiveKey(pathname);
  const mainRef = useRef<HTMLElement | null>(null);
  const isClient = useIsClient();
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { topbar, setTopbar } = useRouteTopbar(pathname);

  useEffect(() => {
    if (!isClient) {
      return;
    }
  }, [isClient]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    let cancelled = false;
    const loadAuth = async () => {
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me");
        if (!me.user) {
          router.replace("/");
          return;
        }
        if (me.user.role === "admin") {
          router.replace("/workspace/admin/dashboard");
          return;
        }
        if (!cancelled) {
          setCurrentUser(me.user);
        }
      } catch {
        if (!cancelled) {
          router.replace("/");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, [isClient, router]);

  const handleNavigate = (tab: string) => {
    router.push(`/workspace/employee/${tab}`);
  };

  const handleLogout = useCallback(() => {
    void apiRequest("/api/auth/logout", undefined, { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        window.localStorage.removeItem(ADMIN_PROJECT_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_PROJECT_STORAGE_KEY);
        router.replace("/");
      });
  }, [router]);

  const contextValue = useMemo<EmployeeWorkspaceContextValue | null>(() => {
    if (!currentUser) {
      return null;
    }

    return {
      currentUser,
      setTopbar,
      showNotice,
      handleLogout,
    };
  }, [currentUser, handleLogout, setTopbar, showNotice]);

  const defaultTopbar = (
    <div className="flex min-h-[40px] items-center">
      <div className="text-xl font-semibold capitalize text-slate-900">
        {activeKey.replace(/-/g, " ")}
      </div>
    </div>
  );

  const shellUser = currentUser
    ? {
        name: userName(currentUser),
        email: currentUser.email,
        role: currentUser.role,
      }
    : { name: "Loading...", email: "", role: "employee" };

  return (
    <EmployeeWorkspaceContext.Provider value={contextValue}>
      <AppShell
        brand={{ title: "Test Case Management", subtitle: "Employee workspace" }}
        user={shellUser}
        navItems={EMPLOYEE_NAV_ITEMS}
        activeKey={activeKey}
        onNavChange={handleNavigate}
        onLogout={handleLogout}
        topbar={topbar ?? defaultTopbar}
        mainRef={mainRef}
      >
        {!isClient || !authReady || !currentUser || !contextValue ? (
          <WorkspaceContentSkeleton />
        ) : (
          children
        )}
      </AppShell>
    </EmployeeWorkspaceContext.Provider>
  );
}
