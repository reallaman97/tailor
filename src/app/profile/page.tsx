import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listSkillGroups } from "@/lib/profile/skills";
import { PersonalInfoForm } from "./personal-info-form";
import { WorkHistorySection } from "./work-history-section";
import { EducationSection } from "./education-section";
import { SkillsSection } from "./skills-section";
import { DeleteAccountSection } from "./delete-account-section";

export default async function ProfilePage() {
  const user = await requireUser();

  const [personalInfo, workHistory, education, skillGroups] = await Promise.all([
    getPersonalInfo(user.id),
    listWorkHistory(user.id),
    listEducation(user.id),
    listSkillGroups(user.id),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>

      <Link href="/profile/import" className="self-start rounded border px-3 py-2 text-sm">
        Import from an existing resume
      </Link>

      {!personalInfo && (
        <p className="rounded border border-dashed p-3 text-sm text-gray-600">
          Save your personal info first — work history, education, and skills unlock afterward.
        </p>
      )}

      <PersonalInfoForm info={personalInfo} />

      {personalInfo && (
        <>
          <WorkHistorySection entries={workHistory} />
          <EducationSection entries={education} />
          <SkillsSection groups={skillGroups} />
        </>
      )}

      <DeleteAccountSection />
    </main>
  );
}
