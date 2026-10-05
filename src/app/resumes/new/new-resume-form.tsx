"use client";

import { createResumeAction } from "./actions";
import { useResumeBuild } from "./use-resume-build";
import { useOpenWorkspace } from "./use-open-workspace";
import { useDuplicateCheck } from "./use-duplicate-check";
import { BuildFooter } from "./build-footer";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NewResumeForm() {
  const build = useResumeBuild(createResumeAction);

  // On success: download the PDF and open this application's workstation.
  useOpenWorkspace(build.outcome.builtId);
  // Warn about a duplicate (same company, posting, or description) before any tokens are spent.
  const { duplicate, onBlur } = useDuplicateCheck();

  return (
    <form
      // Submitted by hand (not <form action>) so the fields keep their values
      // after a failed or stopped build, ready to retry.
      onSubmit={(e) => {
        e.preventDefault();
        build.submit(new FormData(e.currentTarget));
      }}
      onBlur={onBlur}
      className="flex flex-col gap-4"
    >
      <FormField label="Company name" htmlFor="companyName">
        <Input id="companyName" name="companyName" required autoFocus />
      </FormField>
      <FormField label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" required />
      </FormField>
      <FormField
        label="Job posting URL"
        htmlFor="jobLink"
        hint="Used to catch duplicates — if you've already built a resume for this exact posting, we'll stop you here."
      >
        <Input id="jobLink" name="jobLink" placeholder="https:// (optional)" />
      </FormField>
      <FormField label="Job description" htmlFor="jobDescription">
        <Textarea id="jobDescription" name="jobDescription" placeholder="Paste the full job description" required rows={10} />
      </FormField>

      <BuildFooter build={build} duplicate={duplicate} />
    </form>
  );
}
