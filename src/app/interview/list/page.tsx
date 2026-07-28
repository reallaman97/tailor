import Link from "next/link";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { canManageInterviews, listInterviews, listCallers } from "@/lib/interview/interviews";
import { listActiveStatuses, listActiveStages } from "@/lib/interview/config";
import { getInterviewTimezone } from "@/lib/settings";
import { InterviewsTable } from "./interviews-table";

export default async function InterviewListPage() {
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);

  const [interviews, timezone, statuses, stages, callers] = await Promise.all([
    listInterviews(access),
    getInterviewTimezone(),
    listActiveStatuses(),
    listActiveStages(),
    isManager ? listCallers() : Promise.resolve([]),
  ]);

  return (
    <InterviewShell isManager={isManager}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Interviews"
          description={isManager ? "Every scheduled interview." : "Interviews assigned to you."}
          action={
            isManager ? (
              <Link href="/interview/new" className={buttonVariants("primary", "md")}>
                <PlusIcon className="size-4" />
                New Interview
              </Link>
            ) : undefined
          }
        />

        {interviews.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title={isManager ? "No interviews yet" : "No interviews assigned to you yet"}
            description={isManager ? "Create one to get started." : "They'll appear here once a manager assigns you."}
            action={
              isManager ? (
                <Link href="/interview/new" className={buttonVariants("primary", "sm")}>
                  New Interview
                </Link>
              ) : undefined
            }
          />
        ) : (
          <InterviewsTable
            interviews={interviews}
            timezone={timezone}
            isManager={isManager}
            statuses={statuses.map((s) => ({ id: s.id, label: s.label }))}
            stages={stages.map((s) => ({ id: s.id, label: s.label }))}
            callers={callers.map((c) => ({ id: c.id, label: c.name }))}
          />
        )}
      </div>
    </InterviewShell>
  );
}
