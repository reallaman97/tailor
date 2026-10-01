"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResumeAsAdminAction } from "./admin-actions";
import { GenerationProgress } from "./generation-progress";
import { useOpenWorkspace } from "./use-open-workspace";
import { useDuplicateCheck } from "./use-duplicate-check";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SOURCE_OPTIONS } from "@/lib/resume-status";
import { usePersistedState } from "@/lib/use-persisted-state";
import type { ApplicationSource } from "@/generated/prisma/client";

export type BuildableProfile = { id: string; fullName: string | null; userCount: number; hasBaseResume: boolean };

export function AdminNewResumeForm({ profiles }: { profiles: BuildableProfile[] }) {
  const [state, formAction, pending] = useActionState(createResumeAsAdminAction, undefined);
  // Session-scoped: the chosen profile stays fixed across builds/re-renders while
  // the admin works on this page, and is cleared once the page/tab is closed.
  const [profileId, setProfileId] = usePersistedState("admin-resume-builder:profileId", "", { storage: "session" });
  const [source, setSource] = usePersistedState<ApplicationSource>("admin-resume-builder:source", "OTHER", {
    storage: "session",
  });

  // On success: download the PDF and open this application's workstation.
  useOpenWorkspace(state?.resumeId);
  // Warn about a duplicate (same company, posting, or description) before any tokens are spent.
  const { duplicate, onBlur } = useDuplicateCheck(profileId);

  return (
    <form action={formAction} onBlur={onBlur} className="flex flex-col gap-4">
      <FormField
        label="Build for"
        htmlFor="profileId"
        hint="Only profiles with an assigned account and an imported base resume can be tailored for."
      >
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
            <option key={p.id} value={p.id} disabled={!p.hasBaseResume}>
              {p.fullName ?? "Untitled profile"}
              {p.userCount > 1 ? ` (${p.userCount} accounts)` : ""}
              {p.hasBaseResume ? "" : " — no base resume"}
            </option>
          ))}
        </Select>
      </FormField>
      {profiles.some((p) => !p.hasBaseResume) && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Profiles marked &ldquo;no base resume&rdquo; need their full resume uploaded on the{" "}
          <Link href="/admin/profiles" className="underline">
            profile page
          </Link>{" "}
          first.
        </p>
      )}

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
      {!pending && state?.resumeId && <Alert variant="success">Resume built — opening its workstation…</Alert>}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={Boolean(duplicate)}>
          {pending ? (state?.error ? "Retrying…" : "Building…") : state?.error ? "Retry" : "Build resume"}
        </Button>
        <Link href="/resumes" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
