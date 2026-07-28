import Link from "next/link";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";
import { canManageInterviews, listInterviews } from "@/lib/interview/interviews";
import { getInterviewTimezone } from "@/lib/settings";
import { InterviewCalendar } from "./calendar";

export default async function InterviewCalendarPage() {
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);

  const [interviews, timezone] = await Promise.all([listInterviews(access), getInterviewTimezone()]);

  return (
    <InterviewShell isManager={isManager} wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Interview Calendar"
          description={`Times shown in ${timezone}.`}
          action={
            isManager ? (
              <Link href="/interview/new" className={buttonVariants("primary", "md")}>
                <PlusIcon className="size-4" />
                New Interview
              </Link>
            ) : undefined
          }
        />

        <InterviewCalendar interviews={interviews} timezone={timezone} />
      </div>
    </InterviewShell>
  );
}
