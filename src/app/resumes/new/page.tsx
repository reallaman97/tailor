import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { listAllProfiles } from "@/lib/admin/profiles";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { NewResumeForm } from "./new-resume-form";
import { AdminNewResumeForm } from "./admin-new-resume-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

// Resume generation (createResumeAction / admin build) runs the OpenAI tailoring
// call inline, which can take much longer than the default function limit. Give
// the route generous headroom so a slow generation isn't killed mid-flight.
// 60s is the safe ceiling on Vercel Hobby; raise to 300 on Pro/Enterprise (or
// move generation to a background job — see the tailoring pipeline notes).
export const maxDuration = 60;

export default async function NewResumePage() {
  const user = await requireResumePlatformAccess();
  const isSuperAdmin = hasTeamAdminPower(user.role);

  const buildableProfiles = isSuperAdmin
    ? (await listAllProfiles())
        .filter((p) => p.assignedUsers.length > 0)
        .map((p) => ({ id: p.id, fullName: p.fullName, userCount: p.assignedUsers.length }))
    : null;

  return (
    <AppShell userEmail={user.email} isSuperAdmin={isSuperAdmin}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="Resume Builder"
          description={
            isSuperAdmin
              ? "Build a tailored resume on behalf of any profile with an assigned account."
              : "Paste the company, title, and job description — build a tailored resume, and it's automatically added to your application tracker."
          }
        />
        <Card>
          <CardContent className="pt-6">
            {isSuperAdmin && buildableProfiles ? (
              <AdminNewResumeForm profiles={buildableProfiles} />
            ) : (
              <NewResumeForm />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
