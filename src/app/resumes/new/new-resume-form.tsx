"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { createResumeAction } from "./actions";
import { ScreenshotUploadDialog } from "@/app/resumes/[id]/screenshot-upload-dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Triggers a browser download of the tailored resume PDF (the route serves it as an attachment). */
function downloadPdf(resumeId: string) {
  const a = document.createElement("a");
  a.href = `/api/resumes/${resumeId}/pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function NewResumeForm() {
  const [state, formAction, pending] = useActionState(createResumeAction, undefined);

  // On a successful build, download the tailored resume right away. The upload
  // dialog (rendered below) auto-opens to collect proof of application.
  useEffect(() => {
    if (state?.resumeId) downloadPdf(state.resumeId);
  }, [state?.resumeId]);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Company name" htmlFor="companyName">
          <Input id="companyName" name="companyName" required autoFocus defaultValue={state?.values?.companyName} />
        </FormField>
        <FormField label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" name="jobTitle" required defaultValue={state?.values?.jobTitle} />
        </FormField>
        <FormField
          label="Job posting URL"
          htmlFor="jobLink"
          hint="Used to catch duplicates — if you've already built a resume for this exact posting, we'll stop you here."
        >
          <Input id="jobLink" name="jobLink" placeholder="https:// (optional)" defaultValue={state?.values?.jobLink} />
        </FormField>
        <FormField label="Job description" htmlFor="jobDescription">
          <Textarea
            id="jobDescription"
            name="jobDescription"
            placeholder="Paste the full job description"
            required
            rows={10}
            defaultValue={state?.values?.jobDescription}
          />
        </FormField>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
        {state?.resumeId && (
          <Alert variant="success">
            Resume built — your PDF is downloading. Upload proof of application in the dialog to finish.
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>
            {pending ? (state?.error ? "Retrying…" : "Building…") : state?.error ? "Retry" : "Build resume"}
          </Button>
          <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            {state?.resumeId ? "Go to applications" : "Cancel"}
          </Link>
        </div>
      </form>

      {state?.resumeId && (
        <ScreenshotUploadDialog
          key={state.resumeId}
          resumeId={state.resumeId}
          hasScreenshot={false}
          autoOpen
          showTrigger={false}
        />
      )}
    </>
  );
}
