"use client";

import { useEffect, useRef } from "react";
import { ScreenshotUpload } from "./screenshot-upload";
import { Button } from "@/components/ui/button";
import { UploadIcon, XIcon } from "@/components/icons";

/**
 * Wraps ScreenshotUpload in a dialog rather than showing it inline. Opened
 * automatically right after the resume is built (autoOpen) — the only moment a
 * Bidder is offered the upload. Pass `showTrigger` to also render a manual
 * open button (used only where a standing upload control is wanted).
 */
export function ScreenshotUploadDialog({
  resumeId,
  hasScreenshot,
  autoOpen = false,
  showTrigger = true,
}: {
  resumeId: string;
  hasScreenshot: boolean;
  autoOpen?: boolean;
  showTrigger?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (autoOpen) dialogRef.current?.showModal();
  }, [autoOpen]);

  return (
    <div className="flex items-center gap-3">
      {showTrigger && (
        <>
          <span className="text-sm text-muted-foreground">
            {hasScreenshot ? "Screenshot uploaded." : "No screenshot uploaded yet."}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()}>
            <UploadIcon className="size-4" />
            {hasScreenshot ? "Replace screenshot" : "Upload proof of application"}
          </Button>
        </>
      )}

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-md rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Proof of application</h3>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload a screenshot showing you submitted this application — a superadmin reviews it before it counts
            as approved.
          </p>
          <ScreenshotUpload resumeId={resumeId} hasScreenshot={hasScreenshot} />
        </div>
      </dialog>
    </div>
  );
}
