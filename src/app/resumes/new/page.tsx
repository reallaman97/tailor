import { requireUser } from "@/lib/auth/require-user";
import { listAllUsers } from "@/lib/admin/users";
import { NewResumeForm } from "./new-resume-form";
import { AdminNewResumeForm } from "./admin-new-resume-form";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default async function NewResumePage() {
  const user = await requireUser();
  const isSuperAdmin = user.role === "SUPERADMIN";

  const buildableUsers = isSuperAdmin
    ? (await listAllUsers())
        .filter((u) => u.assignedProfileId !== null)
        .map((u) => ({ id: u.id, email: u.email, assignedProfileName: u.assignedProfileName }))
    : null;

  return (
    <AppShell userEmail={user.email} isSuperAdmin={isSuperAdmin}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="Resume Builder"
          description={
            isSuperAdmin
              ? "Build a tailored resume on behalf of any user with an assigned profile."
              : "Paste the company, title, and job description — build a tailored resume, and it's automatically added to your application tracker."
          }
        />
        <Card>
          <CardContent className="pt-6">
            {isSuperAdmin && buildableUsers ? (
              <AdminNewResumeForm users={buildableUsers} />
            ) : (
              <NewResumeForm />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
