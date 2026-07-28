import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { canManageInterviews } from "@/lib/interview/interviews";
import { getMyAvailability, getAvailabilityOverview } from "@/lib/interview/availability";
import { getInterviewTimezone } from "@/lib/settings";
import { AvailabilityEditor } from "./availability-editor";
import { AvailabilityAdmin } from "./availability-admin";

export default async function AvailabilityPage() {
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);
  const timezone = await getInterviewTimezone();

  if (isManager) {
    const overview = await getAvailabilityOverview();
    return (
      <InterviewShell isManager wide>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Caller Availability"
            description="Weekly availability submitted by callers, per caller and in aggregate."
          />
          <AvailabilityAdmin overview={overview} timezone={timezone} />
        </div>
      </InterviewShell>
    );
  }

  // Caller: submit/edit their own recurring weekly availability.
  const slots = await getMyAvailability(access.id);
  return (
    <InterviewShell isManager={false}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="My Availability"
          description="Mark the hours you're generally available each week. This repeats weekly until you change it."
        />
        <AvailabilityEditor initialSlots={slots} timezone={timezone} />
      </div>
    </InterviewShell>
  );
}
