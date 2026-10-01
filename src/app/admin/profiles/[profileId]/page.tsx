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
import { getProfileTemplate } from "@/lib/profile/template";
import { getSettings } from "@/lib/settings";
import { styleKeyFromAppDefault } from "@/lib/export/styles";
import { PersonalInfoForm } from "./personal-info-form";
import { WorkHistorySection } from "./work-history-section";
import { EducationSection } from "./education-section";
import { CertificationsSection } from "./certifications-section";
import { SkillsSection } from "./skills-section";
import { TemplateSelector } from "./template-selector";
import { AssignedUsersManager } from "./assigned-users-manager";
import { BaseResumeSection } from "./base-resume-section";
import { getBaseResumeStatus, getBaseResumeText } from "@/lib/base-resume/status";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Replacing the base resume parses through /api/admin/base-resume, but its
// apply action runs on this route — give it room for the transaction.
export const maxDuration = 60;

export default async function AdminEditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ profileId }, { created }] = await Promise.all([params, searchParams]);
  const admin = await requireSuperAdmin();

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, users: { select: { id: true, email: true }, orderBy: { email: "asc" } } },
  });
  if (!profile) notFound();

  const [
    personalInfo,
    workHistory,
    education,
    certifications,
    skillGroups,
    users,
    profileTemplate,
    settings,
    baseResume,
    baseResumeText,
  ] = await Promise.all([
    getPersonalInfo(profileId),
    listWorkHistory(profileId),
    listEducation(profileId),
    listCertifications(profileId),
    listSkillGroups(profileId),
    listAllUsers(),
    getProfileTemplate(profileId),
    getSettings(),
    getBaseResumeStatus(profileId),
    getBaseResumeText(profileId),
  ]);

  const baseResumeStatus = baseResume
    ? {
        importedAt: baseResume.importedAt.toISOString(),
        fileName: baseResume.fileName,
        roles: workHistory.length,
        bullets: workHistory.reduce((n, w) => n + w.achievements.length, 0),
        skills: skillGroups.reduce((n, g) => n + g.skills.length, 0),
      }
    : null;

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={personalInfo?.fullName ?? "Untitled profile"}
          description="Assign this profile to accounts, manage its base resume, and fine-tune any section."
          action={
            <Link href="/admin/profiles" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to all profiles
            </Link>
          }
        />

        {created && (
          <Alert variant="success">
            Profile created from the base resume. Next, assign it to the account(s) that will build resumes for this
            candidate.
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Assigned accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignedUsersManager profileId={profileId} assignedUsers={profile.users} allUsers={users} />
          </CardContent>
        </Card>

        <BaseResumeSection
          profileId={profileId}
          status={baseResumeStatus}
          storedText={baseResumeText}
          currentPersonal={
            personalInfo
              ? {
                  fullName: personalInfo.fullName,
                  contactEmail: personalInfo.contactEmail,
                  phone: personalInfo.phone,
                  linkedinUrl: personalInfo.linkedinUrl ?? "",
                  city: personalInfo.city ?? "",
                  state: personalInfo.state ?? "",
                }
              : null
          }
        />

        <PersonalInfoForm profileId={profileId} info={personalInfo} />
        <TemplateSelector
          profileId={profileId}
          current={profileTemplate}
          appDefaultKey={styleKeyFromAppDefault(settings.resumeTemplate)}
        />
        <WorkHistorySection profileId={profileId} entries={workHistory} />
        <EducationSection profileId={profileId} entries={education} />
        <CertificationsSection profileId={profileId} entries={certifications} />
        <SkillsSection profileId={profileId} groups={skillGroups} />
      </div>
    </AppShell>
  );
}
