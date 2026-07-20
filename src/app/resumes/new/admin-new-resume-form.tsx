"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResumeAsAdminAction } from "./admin-actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SOURCE_OPTIONS } from "@/lib/resume-status";

export type BuildableUser = { id: string; email: string; assignedProfileName: string | null };

export function AdminNewResumeForm({ users }: { users: BuildableUser[] }) {
  const [state, formAction, pending] = useActionState(createResumeAsAdminAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Build for" htmlFor="targetUserId" hint="Only users with an assigned profile can be tailored for.">
        <Select id="targetUserId" name="targetUserId" required defaultValue="">
          <option value="" disabled>
            Select a user / profile
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email} — {u.assignedProfileName ?? "no profile"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Source" htmlFor="source">
        <Select id="source" name="source" defaultValue="OTHER">
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Company name" htmlFor="companyName">
        <Input id="companyName" name="companyName" required />
      </FormField>
      <FormField label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" required />
      </FormField>
      <FormField
        label="Job posting URL"
        htmlFor="jobLink"
        hint="Used to catch duplicates — if that user already has a resume built for this exact posting, we'll stop you here."
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
