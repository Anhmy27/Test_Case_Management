"use client";

import { useEffect, useState } from "react";
import { fetchRunResultFailureScreenshot, hasFailureScreenshot } from "@/lib/automationArtifacts";

type FailureScreenshotProps = {
  runId: string;
  resultId: string;
  failureScreenshot?: string;
  token: string;
  status?: string;
};

export default function FailureScreenshot({
  runId,
  resultId,
  failureScreenshot,
  token,
  status,
}: FailureScreenshotProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canShowScreenshot = status === "fail" && hasFailureScreenshot(failureScreenshot);

  useEffect(() => {
    if (!canShowScreenshot || !token) {
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
        const nextObjectUrl = await fetchRunResultFailureScreenshot({ runId, resultId, token });
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
  }, [canShowScreenshot, resultId, runId, token]);

  if (status !== "fail") {
    return null;
  }

  if (!hasFailureScreenshot(failureScreenshot)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Không có screenshot cho case fail này.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
        Screenshot khi fail
      </div>
      {loading ? (
        <div className="mt-2 text-xs text-rose-800">Đang tải screenshot...</div>
      ) : errorMessage ? (
        <div className="mt-2 text-xs text-rose-800">{errorMessage}</div>
      ) : imageSrc ? (
        <img
          alt="Failure screenshot"
          className="mt-2 max-h-[480px] w-full rounded-lg border border-rose-200 bg-white object-contain"
          src={imageSrc}
        />
      ) : null}
    </div>
  );
}
