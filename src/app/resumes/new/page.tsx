import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { listAllProfiles } from "@/lib/admin/profiles";
import { NewResumeForm } from "./new-resume-form";
import { AdminNewResumeForm } from "./admin-new-resume-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewResumePage() {
  const user = await requireResumePlatformAccess();
  const isSuperAdmin = user.role === "SUPERADMIN";

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
