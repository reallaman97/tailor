import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireSuperAdmin } from "@/lib/auth/require-user";
import { getResume } from "@/lib/resumes/resumes";
import { getApplicationDetail } from "@/lib/admin/applications";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getTailoredContent } from "@/lib/tailoring/tailor-resume";
import { GenerateButton } from "./generate-button";
import { DetailsForm } from "./details-form";
import { ScreenshotUpload } from "./screenshot-upload";
import { StatusMultiSelect } from "../status-select";
import { AppShell } from "@/components/app-shell";
import { ApprovalStatusCell } from "@/components/approval-status-cell";
import { StatusBadges } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_TRACK_LABEL } from "@/lib/resume-status";
import { ExternalLinkIcon, DownloadIcon } from "@/components/icons";

const DAY_MS = 86_400_000;

function daysOpen(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / DAY_MS);
}

export default async function ResumeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isSuperAdmin = user.role === "SUPERADMIN";

  let resume = await getResume(user.id, id);
  let isOwnResume = true;
  let ownerUserId = user.id;

  if (!resume && isSuperAdmin) {
    // Re-check fresh from the DB before granting cross-user access — never
    // trust the cached JWT role claim for an actual authorization decision.
    await requireSuperAdmin();
    const adminResume = await getApplicationDetail(id);
    if (adminResume) {
      resume = adminResume;
      isOwnResume = adminResume.userId === user.id;
      ownerUserId = adminResume.userId;
    }
  }
  if (!resume) notFound();

  // Shown whenever this entry wasn't created by the current viewer — either
  // a teammate sharing the same profile, or (for a superadmin) any user's entry.
  const appliedByOther = resume.appliedByEmail !== user.email ? resume.appliedByEmail : null;

  const [resumeFields, tailoredContent] = isOwnResume
    ? await Promise.all([getResumeFields(user.id), getTailoredContent(user.id, id)])
    : [null, await getTailoredContent(ownerUserId, id)];

  const workHistoryById = new Map((resumeFields?.workHistory ?? []).map((w) => [w.id, w]));

  return (
    <AppShell userEmail={user.email} isSuperAdmin={isSuperAdmin}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {resume.jobTitle} <span className="text-muted-foreground">at</span> {resume.companyName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {appliedByOther && <Badge variant="outline">Applied by {appliedByOther}</Badge>}
              {resume.jobLink && (
                <a
                  href={resume.jobLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View posting <ExternalLinkIcon className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          <Link href="/resumes" className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline">
            Back to applications
          </Link>
        </div>

        {/* Resume Builder — the job description and the tailored resume generated for it. */}
        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Resume builder</h2>

          <Card>
            <CardContent className="pt-6">
              <details>
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Job description
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {resume.jobDescription}
                </p>
              </details>
            </CardContent>
          </Card>

          {isOwnResume ? (
            <>
              {!resumeFields && (
                <Alert>
                  Your profile hasn&apos;t been set up yet. Contact an administrator before generating a
                  tailored resume.
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <GenerateButton resumeId={resume.id} hasContent={!!tailoredContent} />
                {resumeFields && (
                  <a href={`/resumes/${resume.id}/pdf`} className={buttonVariants("outline", "md")}>
                    <DownloadIcon className="size-4" />
                    Download PDF
                  </a>
                )}
              </div>
            </>
          ) : (
            !tailoredContent && (
              <p className="text-sm text-muted-foreground">This user hasn&apos;t generated a tailored resume yet.</p>
            )
          )}

          {tailoredContent && (
            <Card>
              <CardHeader>
                <CardTitle>Tailored resume</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Generated {resume.generatedAt?.toLocaleString()}
                  {resume.modelUsed && ` · model ${resume.modelUsed}`}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Summary
                  </h3>
                  <p className="text-sm text-foreground">{tailoredContent.summary}</p>
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Work history
                  </h3>
                  {tailoredContent.workHistory.map((entry) => {
                    const source = workHistoryById.get(entry.entryId);
                    return (
                      <div key={entry.entryId} className="flex flex-col gap-1.5">
                        <p className="text-sm font-medium text-foreground">
                          {source ? `${source.jobTitle} — ${source.company}` : "Unknown entry"}
                        </p>
                        <ul className="list-inside list-disc text-sm text-muted-foreground">
                          {entry.bullets.map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Skills
                  </h3>
                  <p className="text-sm text-foreground">{tailoredContent.orderedSkills.join(", ")}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Application tracking — automatically created when this resume was built. Most of this section is superadmin-only. */}
        <section className="flex flex-col gap-6 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Application tracking
            </h2>
            {isSuperAdmin ? (
              <StatusMultiSelect resumeId={resume.id} statuses={resume.statuses} />
            ) : (
              <StatusBadges statuses={resume.statuses} />
            )}
            <ApprovalStatusCell
              resumeId={resume.id}
              approvalStatus={resume.approvalStatus}
              hasScreenshot={resume.hasScreenshot}
            />
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Applied: <span className="text-foreground">{resume.appliedAt ? resume.appliedAt.toLocaleDateString() : "—"}</span>
            </span>
            {isSuperAdmin && (
              <>
                <span className="text-muted-foreground">
                  Role track: <span className="text-foreground">{ROLE_TRACK_LABEL[resume.roleTrack]}</span>
                </span>
                <span className="text-muted-foreground">
                  Days open: <span className="text-foreground">{daysOpen(resume.createdAt)}</span>
                </span>
                <span className="text-muted-foreground">
                  Updated: <span className="text-foreground">{resume.updatedAt.toLocaleDateString()}</span>
                </span>
              </>
            )}
          </div>

          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Tracking details</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailsForm
                  resumeId={resume.id}
                  source={resume.source}
                  followUpDate={resume.followUpDate}
                  notes={resume.notes}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Proof of application</CardTitle>
              <CardDescription>
                {isOwnResume
                  ? "Upload a screenshot showing you submitted this application — a superadmin reviews it before it counts as approved."
                  : "Proof of application uploaded by this user."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScreenshotUpload
                resumeId={resume.id}
                hasScreenshot={resume.hasScreenshot}
                readOnly={!isOwnResume}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
