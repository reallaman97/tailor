import { redirect } from "next/navigation";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listWorkHistory } from "@/lib/profile/work-history";
import { listEducation } from "@/lib/profile/education";
import { listSkillGroups } from "@/lib/profile/skills";
import { formatYearMonth } from "@/lib/profile/date-utils";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LockIcon } from "@/components/icons";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireResumePlatformAccess();
  // Superadmin manages every profile from /admin/profiles instead of having
  // their own personal "assigned profile" view.
  if (user.role === "SUPERADMIN") redirect("/admin/profiles");

  const profileId = await getAssignedProfileId(user.id);

  const [personalInfo, workHistory, education, skillGroups] = profileId
    ? await Promise.all([
        getPersonalInfo(profileId),
        listWorkHistory(profileId),
        listEducation(profileId),
        listSkillGroups(profileId),
      ])
    : [null, [], [], []];

  return (
    <AppShell userEmail={user.email}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Your profile"
          description="Read-only — an administrator manages this data on your behalf."
        />

        {!personalInfo ? (
          <EmptyState
            icon={LockIcon}
            title="Your profile hasn't been set up yet"
            description="Contact an administrator to have your career details added before you can generate tailored resumes."
          />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Personal info</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" value={personalInfo.fullName} />
                <Field label="Contact email" value={personalInfo.contactEmail} />
                <Field label="Phone" value={personalInfo.phone} />
                <Field label="LinkedIn" value={personalInfo.linkedinUrl} />
                <Field label="City" value={personalInfo.city} />
                <Field label="State" value={personalInfo.state} />
                <div className="sm:col-span-2">
                  <Field label="Professional summary" value={personalInfo.professionalSummary} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work history</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {workHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                )}
                {workHistory.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border p-4">
                    <p className="font-medium text-foreground">
                      {entry.jobTitle} <span className="text-muted-foreground">at</span> {entry.company}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.location ? `${entry.location} · ` : ""}
                      {formatYearMonth(entry.startDate)} – {entry.endDate ? formatYearMonth(entry.endDate) : "Present"}
                    </p>
                    {entry.achievements.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm text-foreground">
                        {entry.achievements.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Education</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {education.length === 0 && (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                )}
                {education.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border p-4">
                    <p className="font-medium text-foreground">
                      {entry.degree}
                      {entry.field ? `, ${entry.field}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{entry.institution}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {skillGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground">No entries yet.</p>
                )}
                {skillGroups.map((group) => (
                  <Field
                    key={group.category}
                    label={group.category}
                    value={group.skills.join(", ") || null}
                  />
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
