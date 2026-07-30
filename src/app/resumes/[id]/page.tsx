import Link from "next/link";
import { notFound } from "next/navigation";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { getResume, type ResumeDetail } from "@/lib/resumes/resumes";
import { getApplicationDetail, type AdminApplicationDetail } from "@/lib/admin/applications";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { decryptTailoredContent } from "@/lib/tailoring/tailor-resume";
import { DetailsForm } from "./details-form";
import { StatusMultiSelect } from "../status-select";
import { ApprovalSelect } from "../approval-select";
import { AppShell } from "@/components/app-shell";
import { ApprovalStatusCell } from "@/components/approval-status-cell";
import { StatusBadges } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { ROLE_TRACK_LABEL, getPrimaryStatus } from "@/lib/resume-status";
import { ExternalLinkIcon, DownloadIcon } from "@/components/icons";
import type { ResumeStatus } from "@/generated/prisma/client";

const DAY_MS = 86_400_000;

/**
 * Days the application has been open, counting from when it was Applied (or
 * from created, if it was never applied). The count freezes once the
 * application moves beyond "Applied" — i.e. its first response/outcome — using
 * the Updated timestamp as that freeze point; while still just Applied (no
 * response) it keeps counting to now.
 */
function daysOpen(resume: {
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  statuses: ResumeStatus[];
}): number {
  const start = (resume.appliedAt ?? resume.createdAt).getTime();
  const primary = getPrimaryStatus(resume.statuses);
  const stillWaiting = primary === "DRAFT" || primary === "APPLIED";
  const end = stillWaiting ? Date.now() : resume.updatedAt.getTime();
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

export default async function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();
  const isSuperAdmin = user.role === "SUPERADMIN";

  // Single authoritative fetch per role, no redundant round trips:
  // - Superadmins may view any application, so read it unscoped in one query
  //   (it already carries ownership). `user.role` above is the fresh DB value
  //   from requireResumePlatformAccess, so no second role re-check is needed.
  // - Everyone else reads their own (profile-scoped) resume.
  let resume: ResumeDetail | AdminApplicationDetail | null;
  let ownerUserId: string;
  if (isSuperAdmin) {
    const adminResume = await getApplicationDetail(id);
    resume = adminResume;
    ownerUserId = adminResume?.userId ?? user.id;
  } else {
    resume = await getResume(user.id, id);
    ownerUserId = user.id;
  }
  if (!resume) notFound();

  const isOwnResume = ownerUserId === user.id;

  // Shown whenever this entry wasn't created by the current viewer — either
  // a teammate sharing the same profile, or (for a superadmin) any user's entry.
  // Compared by the stable email, but displayed by the creator's username.
  const appliedByOther = resume.appliedByEmail !== user.email ? resume.appliedByName : null;

  // Fields are anchored to the resume's own profile (not the viewer's current
  // assignment), so the work-history labels below always match the tailored
  // content — which is keyed to the same profileId — even after a reassignment.
  // tailoredContentEnc was already loaded above, so decrypt it in place rather
  // than re-fetching the same resume row.
  const [resumeFields, tailoredContent] = await Promise.all([
    getResumeFieldsForResume(ownerUserId, resume.profileId),
    decryptTailoredContent(resume.profileId, resume.tailoredContentEnc),
  ]);

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

          {!resumeFields && isOwnResume && (
            <Alert>
              Your profile hasn&apos;t been set up yet. Contact an administrator so a tailored resume can be
              generated for you.
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {resumeFields && (
              <a href={`/api/resumes/${resume.id}/pdf`} className={buttonVariants("outline", "md")}>
                <DownloadIcon className="size-4" />
                Download tailored resume
              </a>
            )}
            <a href={`/api/resumes/${resume.id}/job-description`} className={buttonVariants("outline", "md")}>
              <DownloadIcon className="size-4" />
              Download JD
            </a>
          </div>

          {!tailoredContent && (
            <p className="text-sm text-muted-foreground">No tailored resume has been generated for this application yet.</p>
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
                  {tailoredContent.skillCategories && tailoredContent.skillCategories.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {tailoredContent.skillCategories.map((group, i) => (
                        <p key={i} className="text-sm text-foreground">
                          <span className="font-medium">{group.category}:</span> {group.skills.join(", ")}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">{(tailoredContent.orderedSkills ?? []).join(", ")}</p>
                  )}
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
              <StatusBadges statuses={resume.statuses} nowrap />
            )}
            {isSuperAdmin ? (
              <ApprovalSelect
                resumeId={resume.id}
                approvalStatus={resume.approvalStatus}
                hasScreenshot={resume.hasScreenshot}
              />
            ) : (
              <ApprovalStatusCell
                resumeId={resume.id}
                approvalStatus={resume.approvalStatus}
                hasScreenshot={resume.hasScreenshot}
              />
            )}
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
                  Days open: <span className="text-foreground">{daysOpen(resume)}</span>
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
                <DetailsForm resumeId={resume.id} source={resume.source} notes={resume.notes} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Proof of application</CardTitle>
              {!isOwnResume && <CardDescription>Proof of application uploaded by this user.</CardDescription>}
            </CardHeader>
            <CardContent>
              {resume.hasScreenshot ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated, per-application binary served from our own route, not a static/optimizable asset
                <img
                  src={`/api/resumes/${resume.id}/screenshot`}
                  alt="Uploaded proof of application"
                  className="max-h-80 w-auto rounded-md border border-border object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isOwnResume
                    ? "No proof uploaded yet. You're prompted to upload it right after building a resume."
                    : "Empty — this user hasn't uploaded proof yet."}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
