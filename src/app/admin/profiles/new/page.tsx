import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { NewProfileForm } from "./new-profile-form";
import { AdminShell } from "@/components/admin-shell";
import { PageHeader } from "@/components/page-header";

export default async function NewProfilePage() {
  const admin = await requireSuperAdmin();

  return (
    <AdminShell userEmail={admin.email}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="New profile"
          description="Adds a profile to the pool — you'll assign it to an account afterward."
          action={
            <Link href="/admin/profiles" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to all profiles
            </Link>
          }
        />
        <NewProfileForm />
      </div>
    </AdminShell>
  );
}
