"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchRunResultFailureScreenshot,
  hasFailureScreenshot,
  uploadRunResultFailureScreenshot,
} from "@/lib/automationArtifacts";
import ZoomableScreenshot from "./ZoomableScreenshot";

type FailureScreenshotProps = {
  runId: string;
  resultId: string;
  failureScreenshot?: string;
  status?: string;
  canUpload?: boolean;
  onUploaded?: (storageKey: string) => void;
};

export default function FailureScreenshot({
  runId,
  resultId,
  failureScreenshot,
  status,
  canUpload = false,
  onUploaded,
}: FailureScreenshotProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [screenshotKey, setScreenshotKey] = useState(failureScreenshot || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setScreenshotKey(failureScreenshot || "");
  }, [failureScreenshot]);

  const canShowScreenshot = status === "fail" && hasFailureScreenshot(screenshotKey);

  useEffect(() => {
    if (!canShowScreenshot) {
      setImageSrc(null);
      setErrorMessage("");
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadScreenshot = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const nextObjectUrl = await fetchRunResultFailureScreenshot({ runId, resultId });
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        objectUrl = nextObjectUrl;
        setImageSrc(nextObjectUrl);
      } catch (error) {
        if (!cancelled) {
          setImageSrc(null);
          setErrorMessage(error instanceof Error ? error.message : "Không tải được screenshot");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadScreenshot();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [canShowScreenshot, resultId, runId, screenshotKey]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErrorMessage("");
    try {
      const result = await uploadRunResultFailureScreenshot({ runId, resultId, file });
      const nextKey = String(result.failureScreenshot || "").trim();
      if (nextKey) {
        setScreenshotKey(nextKey);
        onUploaded?.(nextKey);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không upload được screenshot");
    } finally {
      setUploading(false);
    }
  };

  if (status !== "fail") {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
          Screenshot khi fail
        </div>
        {canUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                }
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Đang upload..." : hasFailureScreenshot(screenshotKey) ? "Thay ảnh" : "Upload ảnh"}
            </button>
          </>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mt-2 text-xs text-rose-800">{errorMessage}</div>
      ) : null}

      {!hasFailureScreenshot(screenshotKey) ? (
        <div className="mt-2 text-xs text-rose-800">
          {canUpload
            ? "Chưa có screenshot — upload PNG/JPEG/WebP (tối đa 5 MB)."
            : "Không có screenshot cho case fail này."}
        </div>
      ) : loading ? (
        <div className="mt-2 text-xs text-rose-800">Đang tải screenshot...</div>
      ) : imageSrc ? (
        <div className="mt-2">
          <ZoomableScreenshot src={imageSrc} alt="Failure screenshot" />
        </div>
      ) : !errorMessage ? (
        <div className="mt-2 text-xs text-rose-800">Không tải được preview screenshot.</div>
      ) : null}
    </div>
  );
}
