import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { listAllUsers } from "@/lib/admin/users";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listCertifications } from "@/lib/profile/certifications";
import { listSkillGroups } from "@/lib/profile/skills";
import { PersonalInfoForm } from "./personal-info-form";
import { WorkHistorySection } from "./work-history-section";
import { EducationSection } from "./education-section";
import { CertificationsSection } from "./certifications-section";
import { SkillsSection } from "./skills-section";
import { AssignedUsersManager } from "./assigned-users-manager";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminEditProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  await requireSuperAdmin();

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, users: { select: { id: true, email: true }, orderBy: { email: "asc" } } },
  });
  if (!profile) notFound();

  const [personalInfo, workHistory, education, certifications, skillGroups, users] = await Promise.all([
    getPersonalInfo(profileId),
    listWorkHistory(profileId),
    listEducation(profileId),
    listCertifications(profileId),
    listSkillGroups(profileId),
    listAllUsers(),
  ]);

  return (
    <AccountShell isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={personalInfo?.fullName ?? "Untitled profile"}
          description="Editing this profile — assign it to one or more accounts below."
          action={
            <Link href="/admin/profiles" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to all profiles
            </Link>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Assigned accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignedUsersManager profileId={profileId} assignedUsers={profile.users} allUsers={users} />
          </CardContent>
        </Card>

        <PersonalInfoForm profileId={profileId} info={personalInfo} />
        <WorkHistorySection profileId={profileId} entries={workHistory} />
        <EducationSection profileId={profileId} entries={education} />
        <CertificationsSection profileId={profileId} entries={certifications} />
        <SkillsSection profileId={profileId} groups={skillGroups} />
      </div>
    </AccountShell>
  );
}
