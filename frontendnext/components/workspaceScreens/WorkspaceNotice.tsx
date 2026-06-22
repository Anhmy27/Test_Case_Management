"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type WorkspaceNoticeVariant = "success" | "error" | "info";

type NoticeState = {
  message: string;
  variant: WorkspaceNoticeVariant;
};

type WorkspaceNoticeContextValue = {
  showNotice: (message: string, variant?: WorkspaceNoticeVariant) => void;
  clearNotice: () => void;
};

const WorkspaceNoticeContext = createContext<WorkspaceNoticeContextValue | null>(null);

const NOTICE_AUTO_HIDE_MS = 3000;

export function WorkspaceNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotice = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotice(null);
  }, []);

  const showNotice = useCallback((message: string, variant: WorkspaceNoticeVariant = "success") => {
    const text = String(message || "").trim();
    if (!text) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setNotice({ message: text, variant });
    timerRef.current = setTimeout(() => {
      setNotice(null);
      timerRef.current = null;
    }, NOTICE_AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => clearNotice(), [clearNotice]);

  const value = useMemo(() => ({ showNotice, clearNotice }), [clearNotice, showNotice]);

  return (
    <WorkspaceNoticeContext.Provider value={value}>
      {children}
      {notice ? (
        <div
          className={`tcm-toast${notice.variant === "success" ? " tcm-toast--success" : ""}${notice.variant === "error" ? " tcm-toast--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span>{notice.message}</span>
          <button type="button" className="tcm-toast__close" onClick={clearNotice} aria-label="Close notice">
            ×
          </button>
        </div>
      ) : null}
    </WorkspaceNoticeContext.Provider>
  );
}

export function useWorkspaceNotice() {
  const context = useContext(WorkspaceNoticeContext);
  if (!context) {
    throw new Error("useWorkspaceNotice must be used within WorkspaceNoticeProvider");
  }
  return context;
}

export function useOptionalWorkspaceNotice() {
  return useContext(WorkspaceNoticeContext);
}
