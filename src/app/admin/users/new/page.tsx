import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NewUserForm } from "./new-user-form";

export default async function NewUserPage() {
  await requireSuperAdmin();

  return (
    <AccountShell isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New User"
          description="Create an account directly — no email verification needed."
          action={
            <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Back to users
            </Link>
          }
        />
        <Card>
          <CardContent className="pt-6">
            <NewUserForm />
          </CardContent>
        </Card>
      </div>
    </AccountShell>
  );
}
