import { formatYearMonth } from "@/lib/profile/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecryptedPersonalInfo } from "@/lib/profile/personal-info";
import type { DecryptedWorkHistoryEntry } from "@/lib/profile/work-history";
import type { EducationEntry } from "@/lib/profile/education";
import type { CertificationEntry } from "@/lib/profile/certifications";
import type { SkillGroupView } from "@/lib/profile/skills";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

/** Read-only rendering of a candidate profile — an administrator manages this data. */
export function ProfileView({
  personalInfo,
  workHistory,
  education,
  certifications = [],
  skillGroups,
}: {
  personalInfo: DecryptedPersonalInfo;
  workHistory: DecryptedWorkHistoryEntry[];
  education: EducationEntry[];
  certifications?: CertificationEntry[];
  skillGroups: SkillGroupView[];
}) {
  return (
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
          {workHistory.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
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
          {education.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
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

      {certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {certifications.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border p-4">
                <p className="font-medium text-foreground">{entry.name}</p>
                {(entry.issuer || entry.issueDate) && (
                  <p className="text-sm text-muted-foreground">
                    {entry.issuer ?? ""}
                    {entry.issuer && entry.issueDate ? " · " : ""}
                    {entry.issueDate ? formatYearMonth(entry.issueDate) : ""}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {skillGroups.length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
          {skillGroups.map((group) => (
            <Field key={group.category} label={group.category} value={group.skills.join(", ") || null} />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
