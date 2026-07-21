import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listSkillGroups } from "@/lib/profile/skills";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { ProfileView } from "@/components/profile-view";
import { AccountForms } from "./account-forms";

export default async function AccountPage() {
  const user = await requireUser();
  const isSuperAdmin = user.role === "SUPERADMIN";

  const account = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, email: true },
  });

  // Bidders/callers: their read-only assigned profile is shown here.
  // Superadmins manage every profile from the Profiles page instead.
  const profileId = isSuperAdmin ? null : await getAssignedProfileId(user.id);
  const profile = profileId
    ? await (async () => {
        const [personalInfo, workHistory, education, skillGroups] = await Promise.all([
          getPersonalInfo(profileId),
          listWorkHistory(profileId),
          listEducation(profileId),
          listSkillGroups(profileId),
        ]);
        return personalInfo ? { personalInfo, workHistory, education, skillGroups } : null;
      })()
    : null;

  return (
    <AccountShell isSuperAdmin={isSuperAdmin}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-6">
          <PageHeader title="My account" description="Manage your username and password." />
          <AccountForms username={account.username} email={account.email} />
        </div>

        {profile && (
          <div className="flex flex-col gap-6 border-t border-border pt-8">
            <PageHeader
              title="Your profile"
              description="Read-only — an administrator manages this data on your behalf."
            />
            <ProfileView {...profile} />
          </div>
        )}
      </div>
    </AccountShell>
  );
}
