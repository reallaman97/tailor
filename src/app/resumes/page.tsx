import Link from "next/link";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { listResumes } from "@/lib/resumes/resumes";
import { listAllApplications } from "@/lib/admin/applications";
import { getTeamContext } from "@/lib/auth/team-context";
import { AdminApplicationsTable } from "./admin-applications-table";
import { UserApplicationsTable } from "./user-applications-table";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon, FileTextIcon } from "@/components/icons";

export default async function ResumesPage() {
  const user = await requireResumePlatformAccess();
  const isSuperAdmin = hasTeamAdminPower(user.role);

  if (isSuperAdmin) {
    const ctx = await getTeamContext();
    const applications = await listAllApplications({ teamId: ctx?.activeTeamId ?? undefined });

    return (
      <AppShell userEmail={user.email} isSuperAdmin wide>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Applications"
            description={`Every user's tracked applications — showing ${applications.length} application${applications.length === 1 ? "" : "s"}, newest applied first. Sort or filter any column from its header.`}
          />

          {applications.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="No applications tracked yet"
              description="Applications appear here automatically once a user builds a resume."
            />
          ) : (
            <AdminApplicationsTable applications={applications} />
          )}
        </div>
      </AppShell>
    );
  }

  // Normal user: their own applications only, with a deliberately restricted
  // column set — role track, source, days open, follow-up, and updated-at
  // are superadmin-only, as is changing status/source/approval.
  const resumes = await listResumes(user.id);

  return (
    <AppShell userEmail={user.email} isSuperAdmin={false}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Applications"
          description={`Automatically tracked from the Resume Builder — showing ${resumes.length} application${resumes.length === 1 ? "" : "s"}. Sort or filter any column from its header.`}
        />

        {resumes.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="No applications tracked yet"
            description="Build your first tailored resume and it'll show up here automatically."
            action={
              <Link href="/resumes/new" className={buttonVariants("primary", "sm")}>
                <PlusIcon className="size-4" />
                Build a resume
              </Link>
            }
          />
        ) : (
          <UserApplicationsTable resumes={resumes} />
        )}
      </div>
    </AppShell>
  );
}
