import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { NewProfileWizard } from "./new-profile-wizard";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

// Creating the profile writes every section in one transaction.
export const maxDuration = 60;

export default async function NewProfilePage() {
  const admin = await requireSuperAdmin();

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          title="New profile"
          description="Start from the candidate's resume — we'll fill in the profile for you to review."
          action={
            <Link href="/admin/profiles" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to all profiles
            </Link>
          }
        />
        <NewProfileWizard />
      </div>
    </AppShell>
  );
}
