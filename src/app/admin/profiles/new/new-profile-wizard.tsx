"use client";

import { useState } from "react";
import { createProfileFromResumeAction } from "../actions";
import { ResumeUpload } from "../_components/resume-upload";
import { ProfileReviewForm } from "../_components/profile-review-form";
import { draftToInput } from "@/lib/base-resume/reviewed-profile";
import type { BaseResumeImport } from "@/lib/base-resume/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A profile can only be created from the candidate's base resume: upload it,
 * we analyze it and prefill every section, the admin confirms or corrects the
 * fields, and only then is the profile created.
 */
export function NewProfileWizard() {
  const [parsed, setParsed] = useState<BaseResumeImport | null>(null);
  // Bumped on "start over" so the review form remounts with fresh state.
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <Steps current={parsed ? 2 : 1} />

      {!parsed ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload the candidate&apos;s resume</CardTitle>
            <CardDescription>
              Use their complete, original resume — every role and bullet. It&apos;s read word-for-word into the profile
              and becomes the foundation every tailored resume is generated from.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResumeUpload
              onParsed={(result) => {
                setParsed(result);
                setAttempt((n) => n + 1);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <ProfileReviewForm
          key={attempt}
          mode="create"
          initial={draftToInput(parsed.draft, parsed.contact)}
          check={parsed.check}
          sourceText={parsed.sourceText}
          fileName={parsed.fileName}
          onSubmit={createProfileFromResumeAction}
          onStartOver={() => setParsed(null)}
        />
      )}
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  const steps = ["Upload resume", "Review & confirm"];
  return (
    <ol className="flex items-center gap-3 text-sm" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-3" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 && <span aria-hidden className="h-px w-8 bg-border" />}
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-success bg-success text-success-foreground",
                state === "current" && "border-primary bg-primary text-primary-foreground",
                state === "upcoming" && "border-border text-muted-foreground"
              )}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={cn(state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
