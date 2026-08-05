import Link from "next/link";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";
import { canManageInterviews, listInterviews } from "@/lib/interview/interviews";
import { getInterviewTimezone } from "@/lib/settings";
import { isGoogleConfigured } from "@/lib/calendar/google";
import { loadCalendarOverlay } from "@/lib/calendar/events";
import { InterviewCalendar } from "./calendar";
import { CalendarSync } from "./calendar-sync";

export default async function InterviewCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);
  const { calendar: notice } = await searchParams;

  const [interviews, timezone] = await Promise.all([listInterviews(access), getInterviewTimezone()]);

  // Connection state + overlay events (refreshed on the fly when stale).
  const configured = isGoogleConfigured();
  const { connection, events: externalEvents } = await loadCalendarOverlay(access.id);

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

        <CalendarSync configured={configured} connection={connection} notice={notice} />

        <InterviewCalendar interviews={interviews} externalEvents={externalEvents} timezone={timezone} />
      </div>
    </InterviewShell>
  );
}
