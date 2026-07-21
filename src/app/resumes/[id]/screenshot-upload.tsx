"use client";

import { useActionState } from "react";
import { uploadScreenshotAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { UploadIcon } from "@/components/icons";

export function ScreenshotUpload({ resumeId, hasScreenshot }: { resumeId: string; hasScreenshot: boolean }) {
  const action = uploadScreenshotAction.bind(null, resumeId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="flex flex-col gap-3">
      {hasScreenshot && (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated, per-application binary served from our own route, not a static/optimizable asset
        <img
          src={`/api/resumes/${resumeId}/screenshot`}
          alt="Uploaded proof of application"
          className="max-h-80 w-auto rounded-md border border-border object-contain"
        />
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <label
          htmlFor="screenshot"
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <UploadIcon className="size-4" />
          {hasScreenshot ? "Replace screenshot" : "Upload a screenshot as proof you applied"}
          <input
            id="screenshot"
            name="screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="sr-only"
          />
        </label>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
        {state?.success && (
          <Alert variant="success">Uploaded — this application is now pending superadmin approval.</Alert>
        )}

        <Button type="submit" size="sm" loading={pending} className="self-start">
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
