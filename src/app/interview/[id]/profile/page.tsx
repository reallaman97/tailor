import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { InterviewShell } from "@/components/interview-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { UserIcon } from "@/components/icons";
import { canManageInterviews, getInterview } from "@/lib/interview/interviews";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listSkillGroups } from "@/lib/profile/skills";
import { ProfileView } from "@/components/profile-view";

/**
 * The interview's shareable Profile view. Per the confirmed decision it requires
 * login: only authenticated users who can see the interview (a manager/super
 * admin, or the assigned caller) reach it — the getInterview() scope enforces
 * that. It renders only resume-safe fields (never the reference-only DOB/address).
 */
export default async function InterviewProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireInterviewAccess();
  const isManager = canManageInterviews(access.role);

  const detail = await getInterview(access, id);
  if (!detail) notFound();

  const back = (
    <Link href={`/interview/${id}`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
      Back to interview
    </Link>
  );

  if (!detail.profileId) {
    return (
      <InterviewShell isManager={isManager}>
        <div className="flex flex-col gap-6">
          <PageHeader title="Candidate Profile" action={back} />
          <EmptyState icon={UserIcon} title="No profile linked" description="This interview has no candidate profile." />
        </div>
      </InterviewShell>
    );
  }

  const [personalInfo, workHistory, education, skillGroups] = await Promise.all([
    getPersonalInfo(detail.profileId),
    listWorkHistory(detail.profileId),
    listEducation(detail.profileId),
    listSkillGroups(detail.profileId),
  ]);

  return (
    <InterviewShell isManager={isManager}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={personalInfo?.fullName ?? "Candidate Profile"}
          description={`${detail.jobTitle} · ${detail.companyName}`}
          action={back}
        />

        {personalInfo ? (
          <ProfileView
            personalInfo={personalInfo}
            workHistory={workHistory}
            education={education}
            skillGroups={skillGroups}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">This profile has no personal info yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </InterviewShell>
  );
}
