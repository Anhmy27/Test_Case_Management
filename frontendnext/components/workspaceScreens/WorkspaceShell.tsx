"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAdminSidebarNav } from "@/components/workspaceScreens/adminNav";
import { EMPLOYEE_NAV_ITEMS } from "@/components/workspaceScreens/employeeNav";
import { WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import { apiRequest, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

const PROJECT_STORAGE_KEY = "tcm_selected_project_id";

type AdminWorkspaceContextValue = {
  token: string;
  currentUser: RecordAny;
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  setTopbar: (node: ReactNode | null) => void;
  handleLogout: () => void;
};

type EmployeeWorkspaceContextValue = {
  token: string;
  currentUser: RecordAny;
  setTopbar: (node: ReactNode | null) => void;
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
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = resolveAdminActiveKey(pathname);
  const mainRef = useRef<HTMLElement | null>(null);
  const [token, setToken] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [clientReady, setClientReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [topbar, setTopbar] = useState<ReactNode | null>(null);

  const navItems = useAdminSidebarNav(selectedProjectId, activeKey, router, {
    enabled: clientReady,
  });

  useEffect(() => {
    setToken(window.localStorage.getItem("tcm_token") || "");
    setSelectedProjectId(window.localStorage.getItem(PROJECT_STORAGE_KEY) || "");
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, selectedProjectId);
    } else {
      window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }, [selectedProjectId]);

  useLayoutEffect(() => {
    setTopbar(null);
  }, [pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    const loadAuth = async () => {
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
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
  }, [clientReady, router, token]);

  const handleNavigate = (tab: string) => {
    router.push(`/workspace/admin/${tab}`);
  };

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("tcm_token");
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    router.replace("/");
  }, [router]);

  const contextValue = useMemo<AdminWorkspaceContextValue | null>(() => {
    if (!currentUser) {
      return null;
    }

    return {
      token,
      currentUser,
      selectedProjectId,
      setSelectedProjectId,
      setTopbar,
      handleLogout,
    };
  }, [currentUser, handleLogout, selectedProjectId, token]);

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
        topbar={topbar ?? defaultTopbar}
        mainRef={mainRef}
      >
        {!clientReady || !authReady || !currentUser || !contextValue ? (
          <WorkspaceContentSkeleton />
        ) : (
          children
        )}
      </AppShell>
    </AdminWorkspaceContext.Provider>
  );
}

export function EmployeeWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = resolveEmployeeActiveKey(pathname);
  const mainRef = useRef<HTMLElement | null>(null);
  const [token, setToken] = useState("");
  const [clientReady, setClientReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [topbar, setTopbar] = useState<ReactNode | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem("tcm_token") || "");
    setClientReady(true);
  }, []);

  useLayoutEffect(() => {
    setTopbar(null);
  }, [pathname]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!clientReady) {
      return;
    }

    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    const loadAuth = async () => {
      try {
        const me = await apiRequest<{ user: RecordAny | null }>("/api/auth/me", token);
        if (!me.user) {
          window.localStorage.removeItem("tcm_token");
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
  }, [clientReady, router, token]);

  const handleNavigate = (tab: string) => {
    router.push(`/workspace/employee/${tab}`);
  };

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("tcm_token");
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    router.replace("/");
  }, [router]);

  const contextValue = useMemo<EmployeeWorkspaceContextValue | null>(() => {
    if (!currentUser) {
      return null;
    }

    return {
      token,
      currentUser,
      setTopbar,
      handleLogout,
    };
  }, [currentUser, handleLogout, token]);

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
        {!clientReady || !authReady || !currentUser || !contextValue ? (
          <WorkspaceContentSkeleton />
        ) : (
          children
        )}
      </AppShell>
    </EmployeeWorkspaceContext.Provider>
  );
}
