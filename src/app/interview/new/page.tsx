import { requireInterviewManager } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { getApplicationPrefill, listCallers } from "@/lib/interview/interviews";
import { listActiveStages, listActiveStatuses, listActiveMeetingTypes } from "@/lib/interview/config";
import { NewInterviewForm } from "./new-interview-form";
import type { InterviewFormValues } from "@/app/interview/shared";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ applicationId?: string }>;
}) {
  await requireInterviewManager();
  const { applicationId } = await searchParams;

  const [stages, statuses, meetingTypes, callers, prefill] = await Promise.all([
    listActiveStages(),
    listActiveStatuses(),
    listActiveMeetingTypes(),
    listCallers(),
    applicationId ? getApplicationPrefill(applicationId) : Promise.resolve(null),
  ]);

  const initialValues: Partial<InterviewFormValues> | undefined = prefill
    ? {
        jobTitle: prefill.jobTitle,
        companyName: prefill.companyName,
        jobDescription: prefill.jobDescription,
        jobPostLink: prefill.jobPostLink ?? "",
      }
    : undefined;

  const toOption = (o: { id: string; label: string }) => ({ id: o.id, label: o.label });

  return (
    <InterviewShell isManager>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New Interview"
          description={
            prefill ? "Creating from an application — fields are pre-filled." : "Schedule an interview from scratch."
          }
        />

        <NewInterviewForm
          initialValues={initialValues}
          applicationId={applicationId}
          fromApplication={Boolean(prefill)}
          stages={stages.map(toOption)}
          statuses={statuses.map(toOption)}
          meetingTypes={meetingTypes.map(toOption)}
          callers={callers.map((c) => ({ id: c.id, label: c.name }))}
        />
      </div>
    </InterviewShell>
  );
}
