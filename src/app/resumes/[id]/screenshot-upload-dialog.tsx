"use client";

import { useEffect, useRef } from "react";
import { ScreenshotUpload } from "./screenshot-upload";
import { Button } from "@/components/ui/button";
import { UploadIcon, XIcon } from "@/components/icons";

/**
 * Wraps ScreenshotUpload in a dialog rather than showing it inline — opened
 * either by the trigger button, or automatically right after building the
 * resume (autoOpen), so proof of application can go straight to a superadmin
 * for review without hunting for the upload control on the page.
 */
export function ScreenshotUploadDialog({
  resumeId,
  hasScreenshot,
  autoOpen = false,
}: {
  resumeId: string;
  hasScreenshot: boolean;
  autoOpen?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (autoOpen) dialogRef.current?.showModal();
  }, [autoOpen]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {hasScreenshot ? "Screenshot uploaded." : "No screenshot uploaded yet."}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()}>
        <UploadIcon className="size-4" />
        {hasScreenshot ? "Replace screenshot" : "Upload proof of application"}
      </Button>

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
              className="text-muted-foreground hover:text-foreground"
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
