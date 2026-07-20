"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResumeAction } from "./actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function NewResumeForm() {
  const [state, formAction, pending] = useActionState(createResumeAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        <Textarea
          id="jobDescription"
          name="jobDescription"
          placeholder="Paste the full job description"
          required
          rows={10}
        />
      </FormField>

      {state?.error && <Alert variant="destructive">{state.error}</Alert>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Building…" : "Build resume"}
        </Button>
        <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
