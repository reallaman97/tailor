"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResumeAction } from "./actions";
import { GenerationProgress } from "./generation-progress";
import { useOpenWorkspace } from "./use-open-workspace";
import { useDuplicateCheck } from "./use-duplicate-check";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function NewResumeForm() {
  const [state, formAction, pending] = useActionState(createResumeAction, undefined);

  // On success: download the PDF and open this application's workstation.
  useOpenWorkspace(state?.resumeId);
  // Warn about a duplicate (same company, posting, or description) before any tokens are spent.
  const { duplicate, onBlur } = useDuplicateCheck();

  return (
    <>
      <form action={formAction} onBlur={onBlur} className="flex flex-col gap-4">
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

        <GenerationProgress active={pending} />

        {!pending && duplicate && !state?.resumeId && (
          <Alert variant="destructive">
            {duplicate.message}{" "}
            <Link href={`/resumes/new?app=${duplicate.id}`} className="font-medium underline">
              Continue working on it
            </Link>
            .
          </Alert>
        )}
        {!pending && state?.error && (
          <Alert variant="destructive">
            {state.error}
            {state.duplicateId && (
              <>
                {" "}
                <Link href={`/resumes/new?app=${state.duplicateId}`} className="font-medium underline">
                  Continue working on it
                </Link>
                .
              </>
            )}
          </Alert>
        )}
        {!pending && state?.resumeId && (
          <Alert variant="success">Resume built — opening its workstation…</Alert>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending} disabled={Boolean(duplicate)}>
            {pending ? (state?.error ? "Retrying…" : "Building…") : state?.error ? "Retry" : "Build resume"}
          </Button>
          <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
