"use client";

import { useActionState, useEffect } from "react";
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
  // Session-scoped: the chosen profile stays fixed across builds/re-renders while
  // the admin works on this page, and is cleared once the page/tab is closed.
  const [profileId, setProfileId] = usePersistedState("admin-resume-builder:profileId", "", { storage: "session" });
  const [source, setSource] = usePersistedState<ApplicationSource>("admin-resume-builder:source", "OTHER", {
    storage: "session",
  });

  // On a successful build, download the tailored resume PDF right away.
  useEffect(() => {
    if (state?.resumeId) {
      const a = document.createElement("a");
      a.href = `/api/resumes/${state.resumeId}/pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [state?.resumeId]);

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
        <Input id="companyName" name="companyName" required defaultValue={state?.values?.companyName} />
      </FormField>
      <FormField label="Job title" htmlFor="jobTitle">
        <Input id="jobTitle" name="jobTitle" required defaultValue={state?.values?.jobTitle} />
      </FormField>
      <FormField
        label="Job posting URL"
        htmlFor="jobLink"
        hint="Used to catch duplicates — if this profile already has a resume built for this exact posting, we'll stop you here."
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

      {state?.error && (
        <Alert variant="destructive">
          {state.error}
          {state.duplicateId && (
            <>
              {" "}
              <Link href={`/resumes/${state.duplicateId}`} className="font-medium underline">
                View the existing application
              </Link>
              .
            </>
          )}
        </Alert>
      )}
      {state?.resumeId && <Alert variant="success">Resume built — the PDF is downloading.</Alert>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? (state?.error ? "Retrying…" : "Building…") : state?.error ? "Retry" : "Build resume"}
        </Button>
        <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          {state?.resumeId ? "Go to applications" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}
