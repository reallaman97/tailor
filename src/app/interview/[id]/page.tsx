import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon, UserIcon } from "@/components/icons";
import { canManageInterviews, getInterview, listCallers } from "@/lib/interview/interviews";
import { listActiveStages, listActiveStatuses, listActiveMeetingTypes } from "@/lib/interview/config";
import { getInterviewTimezone } from "@/lib/settings";
import { utcToDatetimeLocal } from "@/lib/interview/timezone";
import type { InterviewFormValues } from "@/app/interview/shared";
import type { Option } from "@/app/interview/interview-fields";
import { DetailsForm } from "./details-form";
import { InterviewReadView } from "./interview-read-view";
import { StatusControl } from "./status-control";
import { CallerControl } from "./caller-control";
import { CommentThread } from "./comment-thread";
import { ReferenceFiles } from "./reference-files";
import { ResumeControl } from "./resume-control";
import { deleteInterviewAction } from "./actions";

/** Ensures the interview's current stage/status/etc. is selectable even if it's since been deactivated. */
function withCurrent(options: Option[], current: { id: string; label: string } | null): Option[] {
  if (!current || options.some((o) => o.id === current.id)) return options;
  return [{ id: current.id, label: `${current.label} (inactive)` }, ...options];
}

export default async function InterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);

  const detail = await getInterview(access, id);
  if (!detail) notFound();

  const [timezone, activeStages, activeStatuses, activeMeetingTypes, callers] = await Promise.all([
    getInterviewTimezone(),
    listActiveStages(),
    listActiveStatuses(),
    listActiveMeetingTypes(),
    isManager ? listCallers() : Promise.resolve([]),
  ]);

  const toOption = (o: { id: string; label: string }) => ({ id: o.id, label: o.label });
  const stageOptions = withCurrent(activeStages.map(toOption), detail.stage);
  const statusOptions = withCurrent(activeStatuses.map(toOption), detail.status);
  const meetingTypeOptions = withCurrent(activeMeetingTypes.map(toOption), detail.meetingType);
  const callerOptions = withCurrent(
    callers.map((c) => ({ id: c.id, label: c.name })),
    detail.caller ? { id: detail.caller.id, label: detail.caller.name } : null
  );

  const values: InterviewFormValues = {
    jobTitle: detail.jobTitle,
    companyName: detail.companyName,
    jobDescription: detail.jobDescription,
    jobPostLink: detail.jobPostLink ?? "",
    salaryRange: detail.salaryRange ?? "",
    scheduledAt: utcToDatetimeLocal(detail.scheduledAt, timezone),
    meetingLink: detail.meetingLink ?? "",
    interviewerInfo: detail.interviewerInfo ?? "",
    stageId: detail.stage?.id ?? "",
    statusId: detail.status?.id ?? "",
    meetingTypeId: detail.meetingType?.id ?? "",
    callerId: detail.caller?.id ?? "",
    meta: Object.fromEntries(Object.entries(detail.meta).map(([k, v]) => [k, v == null ? "" : String(v)])),
  };

  return (
    <InterviewShell isManager={isManager} wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={detail.jobTitle}
          description={`${detail.companyName}${detail.createdByName ? ` · created by ${detail.createdByName}` : ""}`}
          action={
            <div className="flex items-center gap-2">
              {detail.profileId && (
                <Link href={`/interview/${id}/profile`} className={buttonVariants("outline", "sm")}>
                  <UserIcon className="size-4" />
                  Profile
                </Link>
              )}
              {isManager && (
                <ConfirmDialog
                  title="Delete this interview?"
                  description="It will be removed from the calendar and lists. This can be recovered by an admin."
                  confirmLabel="Delete"
                  triggerVariant="outline"
                  triggerSize="sm"
                  triggerLabel="Delete interview"
                  triggerContent={
                    <span className="flex items-center gap-1.5">
                      <TrashIcon className="size-4" />
                      Delete
                    </span>
                  }
                  action={deleteInterviewAction.bind(null, id)}
                />
              )}
            </div>
          }
        />

        <Card>
          <CardContent className="flex flex-wrap items-end gap-6 pt-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <StatusControl interviewId={id} currentStatusId={detail.status?.id ?? null} statuses={statusOptions} />
            </div>
            {isManager && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Assigned Caller</span>
                <CallerControl interviewId={id} currentCallerId={detail.caller?.id ?? null} callers={callerOptions} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                {isManager ? (
                  <DetailsForm
                    interviewId={id}
                    values={values}
                    stages={stageOptions}
                    statuses={statusOptions}
                    meetingTypes={meetingTypeOptions}
                    callers={callerOptions}
                  />
                ) : (
                  <InterviewReadView detail={detail} timezone={timezone} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResumeControl
                  interviewId={id}
                  hasResumeFile={detail.hasResumeFile}
                  resumeFilename={detail.resumeFilename}
                  isManager={isManager}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reference Files</CardTitle>
              </CardHeader>
              <CardContent>
                <ReferenceFiles interviewId={id} files={detail.referenceFiles} isManager={isManager} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <CommentThread interviewId={id} comments={detail.comments} timezone={timezone} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </InterviewShell>
  );
}
