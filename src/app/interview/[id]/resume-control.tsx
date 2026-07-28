"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadResumeFileAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DownloadIcon } from "@/components/icons";

/**
 * Resume attachment. When created from an application, the tailored resume is
 * auto-attached at creation. Managers can (re)upload one; everyone with access
 * can download it via the scoped API route.
 */
export function ResumeControl({
  interviewId,
  hasResumeFile,
  resumeFilename,
  isManager,
}: {
  interviewId: string;
  hasResumeFile: boolean;
  resumeFilename: string | null;
  isManager: boolean;
}) {
  const uploadAction = uploadResumeFileAction.bind(null, interviewId);
  const [state, formAction, pending] = useActionState(uploadAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      {hasResumeFile ? (
        <a
          href={`/api/interview/${interviewId}/resume`}
          className="flex w-fit items-center gap-2 text-sm text-primary hover:underline"
        >
          <DownloadIcon className="size-4" />
          {resumeFilename ?? "Download resume"}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">No resume attached.</p>
      )}

      {isManager && (
        <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
          {state?.error && <Alert variant="destructive">{state.error}</Alert>}
          <div className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              required
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
            <Button type="submit" size="sm" variant="outline" loading={pending}>
              {hasResumeFile ? "Replace" : "Upload"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">PDF, Word, or image — max 8MB.</p>
        </form>
      )}
    </div>
  );
}
