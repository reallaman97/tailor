"use client";

import { useState } from "react";
import { replaceBaseResumeAction } from "./actions";
import { ResumeUpload } from "../_components/resume-upload";
import { ProfileReviewForm } from "../_components/profile-review-form";
import { draftToInput, type ReviewSubmission, type ReviewedProfileInput } from "@/lib/base-resume/reviewed-profile";
import type { BaseResumeImport } from "@/lib/base-resume/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = { importedAt: string; fileName: string | null; roles: number; bullets: number; skills: number } | null;

/** The profile's current resume-header values — used where the new resume leaves a field blank. */
export type CurrentPersonal = Pick<
  ReviewedProfileInput["personal"],
  "fullName" | "contactEmail" | "phone" | "linkedinUrl" | "city" | "state"
>;

function prefill(parsed: BaseResumeImport, current: CurrentPersonal | null): ReviewedProfileInput {
  const input = draftToInput(parsed.draft, parsed.contact);
  if (current) {
    for (const key of Object.keys(current) as (keyof CurrentPersonal)[]) {
      if (!input.personal[key].trim()) input.personal[key] = current[key];
    }
  }
  return input;
}

/**
 * The profile's base resume: its status, the stored text, and "Replace" —
 * which runs the same upload → review → confirm flow as creating a profile.
 */
export function BaseResumeSection({
  profileId,
  status: serverStatus,
  storedText: serverText,
  currentPersonal,
}: {
  profileId: string;
  status: Status;
  storedText: string | null;
  currentPersonal: CurrentPersonal | null;
}) {
  const [step, setStep] = useState<"idle" | "upload" | "review">("idle");
  const [parsed, setParsed] = useState<BaseResumeImport | null>(null);
  // What was just saved. Shown right away, so the status never depends on the
  // page refresh that follows a save succeeding (it can time out on a slow
  // database link even though the save itself committed).
  const [saved, setSaved] = useState<{ status: NonNullable<Status>; text: string } | null>(null);
  const status = saved?.status ?? serverStatus;
  const storedText = saved?.text ?? serverText;

  async function submit(submission: ReviewSubmission) {
    const result = await replaceBaseResumeAction(profileId, submission);
    if (!result?.error && !result?.fieldErrors) {
      const { profile } = submission;
      setSaved({
        status: {
          importedAt: new Date().toISOString(),
          fileName: submission.fileName,
          roles: profile.workHistory.length,
          bullets: profile.workHistory.reduce((n, w) => n + w.bullets.split("\n").filter((l) => l.trim()).length, 0),
          skills: profile.skills.reduce((n, g) => n + g.skills.split(/[,\n]/).filter((s) => s.trim()).length, 0),
        },
        text: submission.sourceText,
      });
      setParsed(null);
      setStep("idle");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return result;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className={cn(!status && "border-warning/50")}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Base resume</CardTitle>
            {status ? <Badge variant="success">Imported</Badge> : <Badge variant="warning">Missing</Badge>}
          </div>
          <CardDescription>
            The candidate&apos;s full, original resume — the foundation every tailored resume is generated from.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {saved && step === "idle" && (
            <Alert variant="success">
              Base resume saved — this profile can now be used to generate tailored resumes.
            </Alert>
          )}

          {status ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-muted-foreground">
                {status.fileName ? <span className="text-foreground">{status.fileName}</span> : "Pasted text"} · imported{" "}
                {new Date(status.importedAt).toLocaleString()} · {status.roles} roles · {status.bullets} bullets ·{" "}
                {status.skills} skills
              </div>
              {step === "idle" && (
                <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                  Replace base resume
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Alert>
                This profile was created before base resumes were required, so tailored resumes can&apos;t be generated
                for it yet. Upload the candidate&apos;s complete resume to fill it in.
              </Alert>
              {step === "idle" && (
                <Button className="self-start" onClick={() => setStep("upload")}>
                  Upload base resume
                </Button>
              )}
            </div>
          )}

          {storedText && step === "idle" && (
            <details className="rounded-md border border-border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">View stored resume text</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {storedText}
              </pre>
            </details>
          )}

          {step === "upload" && (
            <ResumeUpload
              onParsed={(result) => {
                setParsed(result);
                setStep("review");
              }}
              onCancel={() => setStep("idle")}
            />
          )}
        </CardContent>
      </Card>

      {step === "review" && parsed && (
        <ProfileReviewForm
          mode="replace"
          initial={prefill(parsed, currentPersonal)}
          check={parsed.check}
          sourceText={parsed.sourceText}
          fileName={parsed.fileName}
          onSubmit={submit}
          onStartOver={() => {
            setParsed(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}
