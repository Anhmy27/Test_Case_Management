"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ZoomableScreenshotProps = {
  src: string;
  alt: string;
  previewClassName?: string;
};

type PanOffset = {
  x: number;
  y: number;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const INITIAL_OFFSET: PanOffset = { x: 0, y: 0 };

export default function ZoomableScreenshot({
  src,
  alt,
  previewClassName = "mt-2 max-h-[480px] w-full rounded-lg border border-rose-200 bg-white object-contain",
}: ZoomableScreenshotProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<PanOffset>(INITIAL_OFFSET);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const clampScale = useCallback(
    (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)),
    [],
  );

  const resetView = useCallback(() => {
    setScale(1);
    setOffset(INITIAL_OFFSET);
    dragStartRef.current = null;
    setDragging(false);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((current) => clampScale(Number((current + SCALE_STEP).toFixed(2))));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    setScale((current) => clampScale(Number((current - SCALE_STEP).toFixed(2))));
  }, [clampScale]);

  const openViewer = () => {
    resetView();
    setOpen(true);
  };

  const closeViewer = () => {
    setOpen(false);
    resetView();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeViewer();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        zoomIn();
      }
      if (event.key === "-") {
        zoomOut();
      }
      if (event.key === "0") {
        resetView();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, resetView, zoomIn, zoomOut]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
      return;
    }
    zoomOut();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) {
      return;
    }

    const deltaX = event.clientX - dragStartRef.current.pointerX;
    const deltaY = event.clientY - dragStartRef.current.pointerY;

    setOffset({
      x: dragStartRef.current.offsetX + deltaX,
      y: dragStartRef.current.offsetY + deltaY,
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
    setDragging(false);
  };

  return (
    <>
      <button
        type="button"
        className="group relative mt-2 block w-full cursor-zoom-in text-left"
        onClick={openViewer}
        aria-label={`${alt}. Nhấn để phóng to`}
      >
        <img
          alt={alt}
          className={`${previewClassName} transition group-hover:brightness-95`}
          src={src}
        />
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          Click để phóng to
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm"
          onClick={closeViewer}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{alt}</div>
              <div className="text-xs text-white/70">
                Kéo ảnh để di chuyển · cuộn chuột để zoom · Esc để đóng
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
                onClick={zoomOut}
                aria-label="Thu nhỏ"
              >
                −
              </button>
              <span className="min-w-[56px] text-center text-sm font-semibold">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
                onClick={zoomIn}
                aria-label="Phóng to"
              >
                +
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
                onClick={resetView}
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
                onClick={closeViewer}
              >
                Đóng
              </button>
            </div>
          </div>

          <div
            className={`min-h-0 flex-1 touch-none select-none overflow-hidden p-6 ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onClick={(event) => event.stopPropagation()}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="flex h-full w-full items-center justify-center">
              <img
                alt={alt}
                src={src}
                draggable={false}
                className={`max-w-none select-none ${dragging ? "" : "transition-transform duration-150 ease-out"}`}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
