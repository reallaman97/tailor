import Link from "next/link";
import { CoverLetterCard } from "@/app/resumes/[id]/cover-letter-card";
import { AskAiCard } from "@/app/resumes/[id]/ask-ai-card";
import { ScreenshotUpload } from "@/app/resumes/[id]/screenshot-upload";
import { CancelApplicationButton } from "@/app/resumes/[id]/cancel-application-button";
import type { AssistData } from "@/lib/assist/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon, ExternalLinkIcon, PlusIcon, CheckCircleIcon } from "@/components/icons";

export type WorkspaceApplication = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  hasScreenshot: boolean;
  canceled: boolean;
  /** Not canceled yet, and either the viewer is an admin or no proof is uploaded (it wasn't submitted). */
  canCancel: boolean;
  /** Who it was built for — shown to admins building on someone's behalf. */
  candidateName: string | null;
};

function fileSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "application";
}

/**
 * The Resume Builder's workstation for one application, right after its
 * resume is built: download it, then write the cover letter, answer the
 * application form's questions, and upload proof — without leaving the page.
 */
export function ApplicationWorkspace({
  app,
  assist,
  canUploadProof,
}: {
  app: WorkspaceApplication;
  assist: AssistData;
  /** Proof can only be uploaded by accounts in the application's profile (not an admin building for someone). */
  canUploadProof: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Step 1 — the resume, plus where to go next */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {app.canceled ? (
                  <Badge variant="warning">Canceled</Badge>
                ) : (
                  <Badge variant="success">
                    <CheckCircleIcon className="mr-1 size-3.5" />
                    Resume ready
                  </Badge>
                )}
                {app.candidateName && <Badge variant="outline">For {app.candidateName}</Badge>}
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {app.jobTitle} <span className="text-muted-foreground">at</span> {app.companyName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Download the resume, then use the tools below while you fill in the application.
              </p>
            </div>
            <Link href="/resumes/new" className={buttonVariants("primary", "md")}>
              <PlusIcon className="size-4" />
              Build next resume
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/resumes/${app.id}/pdf`} className={buttonVariants("outline", "sm")}>
              <DownloadIcon className="size-4" />
              Resume PDF
            </a>
            <a href={`/api/resumes/${app.id}/job-description`} className={buttonVariants("outline", "sm")}>
              <DownloadIcon className="size-4" />
              Job description
            </a>
            {app.jobLink && (
              <a href={app.jobLink} target="_blank" rel="noopener noreferrer" className={buttonVariants("outline", "sm")}>
                <ExternalLinkIcon className="size-4" />
                Open job posting
              </a>
            )}
            <Link href={`/resumes/${app.id}`} className={buttonVariants("ghost", "sm")}>
              Application details
            </Link>
            {app.canCancel && (
              <div className="ml-auto">
                <CancelApplicationButton resumeId={app.id} companyName={app.companyName} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <CoverLetterCard
            resumeId={app.id}
            fileBaseName={fileSafe(`${app.candidateName ?? "candidate"}-${app.companyName}`)}
            initial={assist.coverLetter}
          />

          <Card>
            <CardHeader>
              <CardTitle>Proof of application</CardTitle>
              <CardDescription>
                After you submit, upload a screenshot of the confirmation — an admin reviews it before it counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {app.canceled ? (
                <p className="text-sm text-muted-foreground">This application was canceled, so no proof is needed.</p>
              ) : canUploadProof ? (
                <ScreenshotUpload resumeId={app.id} hasScreenshot={app.hasScreenshot} capturePaste />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {app.hasScreenshot
                    ? "A screenshot has been uploaded for this application."
                    : "The account this application belongs to uploads the proof screenshot."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <AskAiCard resumeId={app.id} initialAnswers={assist.answers} />
      </div>
    </div>
  );
}
