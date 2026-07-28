"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { uploadReferenceFileAction, deleteReferenceFileAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DownloadIcon, TrashIcon } from "@/components/icons";
import type { InterviewFileView } from "@/lib/interview/interviews";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReferenceFiles({
  interviewId,
  files,
  isManager,
}: {
  interviewId: string;
  files: InterviewFileView[];
  isManager: boolean;
}) {
  const uploadAction = uploadReferenceFileAction.bind(null, interviewId);
  const [state, formAction, pending] = useActionState(uploadAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the file input after a successful upload.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {files.length === 0 && <li className="text-sm text-muted-foreground">No reference files.</li>}
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
            <a
              href={`/api/interview/${interviewId}/reference/${f.id}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <DownloadIcon className="size-4" />
              {f.filename}
            </a>
            <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
            {isManager && <DeleteFileButton interviewId={interviewId} fileId={f.id} />}
          </li>
        ))}
      </ul>

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
            <Button type="submit" size="sm" loading={pending}>
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">PDF, Word, or image — max 8MB.</p>
        </form>
      )}
    </div>
  );
}

function DeleteFileButton({ interviewId, fileId }: { interviewId: string; fileId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="ml-auto flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Delete file"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteReferenceFileAction(interviewId, fileId);
            if (result?.error) setError(result.error);
          })
        }
      >
        <TrashIcon className="size-4" />
      </Button>
    </div>
  );
}
