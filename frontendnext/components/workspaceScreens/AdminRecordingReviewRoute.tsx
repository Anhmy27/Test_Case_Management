"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminRecordingReviewScreen from "@/components/workspaceScreens/AdminRecordingReviewScreen";
import { useAdminWorkspace } from "@/components/workspaceScreens/WorkspaceShell";
import { TOPBAR_INPUT_CLS, WorkspaceContentSkeleton } from "@/components/workspaceScreens/shared";
import {
  fetchRecordingSession,
  mergeRecordingSession,
  patchRecordingDraft,
  previewRecordingSession,
  type RecordingDraftStepPatch,
  type RecordingPreviewResult,
  type RecordingSession,
} from "@/lib/recordingSession";
import { findEntityByReference, matchesSelectedEntity } from "@/lib/api";

export default function AdminRecordingReviewRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = String(searchParams.get("sessionId") || "").trim();
  const { currentUser, selectedProjectId, projects, setTopbar, showNotice } = useAdminWorkspace();
  const sessionIdInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [merging, setMerging] = useState(false);

  const loadSession = useCallback(async (sessionId: string) => {
    const normalizedId = String(sessionId || "").trim();
    if (!normalizedId) {
      showNotice("Nhập Session ID trước khi tải", "error");
      return;
    }

    setLoading(true);
    try {
      const nextSession = await fetchRecordingSession(normalizedId);
      setSession(nextSession);

      const params = new URLSearchParams();
      params.set("sessionId", normalizedId);
      router.replace(`/workspace/admin/recording-review?${params.toString()}`);
    } catch (error) {
      setSession(null);
      showNotice(error instanceof Error ? error.message : "Không tải được recording session", "error");
    } finally {
      setLoading(false);
    }
  }, [router, showNotice]);

  const handleSaveDraft = useCallback(async (patches: RecordingDraftStepPatch[]) => {
    if (!session) {
      return false;
    }

    setSaving(true);
    try {
      const updatedSession = await patchRecordingDraft(session.id, patches);
      setSession(updatedSession);
      showNotice("Đã lưu thay đổi nháp", "success");
      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không lưu được thay đổi nháp", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [session, showNotice]);

  const handlePreview = useCallback(async (
    options: { baseUrl?: string; webId?: string; userKey?: string },
  ): Promise<RecordingPreviewResult | null> => {
    if (!session) {
      return null;
    }

    setPreviewing(true);
    try {
      return await previewRecordingSession(session.id, options);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không xem thử được recording session", "error");
      return null;
    } finally {
      setPreviewing(false);
    }
  }, [session, showNotice]);

  const handleMerge = useCallback(async (testCaseId: string) => {
    if (!session) {
      return false;
    }

    setMerging(true);
    try {
      const result = await mergeRecordingSession(session.id, testCaseId);
      showNotice(`Đã lưu ${result.mergedStepsCount} bước vào test case`, "success");
      await loadSession(session.id);
      return true;
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Không lưu được vào test case", "error");
      return false;
    } finally {
      setMerging(false);
    }
  }, [session, showNotice, loadSession]);

  useEffect(() => {
    if (!currentUser || !sessionIdFromUrl) {
      return;
    }

    void loadSession(sessionIdFromUrl);
  }, [currentUser, loadSession, sessionIdFromUrl]);

  useLayoutEffect(() => {
    setTopbar(
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={sessionIdInputRef}
          className={`${TOPBAR_INPUT_CLS} min-w-[280px]`}
          placeholder="Recording session ID"
          defaultValue={sessionIdFromUrl}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void loadSession(event.currentTarget.value);
            }
          }}
        />
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => void loadSession(sessionIdInputRef.current?.value || "")}
        >
          Tải nháp
        </button>
      </div>,
    );

    return () => setTopbar(null);
  }, [loadSession, sessionIdFromUrl, setTopbar]);

  // Scope dropdown uses entityId; session.projectId is often the version document _id.
  // Resolve both through the projects list so the same logical project is not flagged.
  const sessionProject = session?.projectId
    ? findEntityByReference(projects, session.projectId)
    : undefined;
  const projectMismatch = Boolean(
    session
    && selectedProjectId
    && session.projectId
    && !(sessionProject
      ? matchesSelectedEntity(sessionProject, selectedProjectId)
      : session.projectId === selectedProjectId),
  );

  if (loading && !session) {
    return <WorkspaceContentSkeleton />;
  }

  return (
    <AdminRecordingReviewScreen
      session={session}
      projectMismatch={projectMismatch}
      onSaveDraft={handleSaveDraft}
      saving={saving}
      onPreview={handlePreview}
      previewing={previewing}
      onMerge={handleMerge}
      merging={merging}
    />
  );
}
