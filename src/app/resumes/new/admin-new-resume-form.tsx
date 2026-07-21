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
import { usePersistedState } from "@/lib/use-persisted-state";
import type { ApplicationSource } from "@/generated/prisma/client";

export type BuildableProfile = { id: string; fullName: string | null; userCount: number };

export function AdminNewResumeForm({ profiles }: { profiles: BuildableProfile[] }) {
  const [state, formAction, pending] = useActionState(createResumeAsAdminAction, undefined);
  const [profileId, setProfileId] = usePersistedState("admin-resume-builder:profileId", "");
  const [source, setSource] = usePersistedState<ApplicationSource>("admin-resume-builder:source", "OTHER");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Build for" htmlFor="profileId" hint="Only profiles with at least one assigned account can be tailored for.">
        <Select
          id="profileId"
          name="profileId"
          required
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          <option value="" disabled>
            Select a profile
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName ?? "Untitled profile"}
              {p.userCount > 1 ? ` (${p.userCount} accounts)` : ""}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Source" htmlFor="source">
        <Select
          id="source"
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value as ApplicationSource)}
        >
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
        hint="Used to catch duplicates — if this profile already has a resume built for this exact posting, we'll stop you here."
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
