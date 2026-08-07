import Link from "next/link";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { listAllUsers } from "@/lib/admin/users";
import { listAllProfiles } from "@/lib/admin/profiles";
import { UsersTable } from "./users-table";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";

export default async function AdminUsersPage() {
  const admin = await requireTeamAdmin();
  const teamId = admin.activeTeamId ?? undefined;
  const [users, profiles] = await Promise.all([listAllUsers(teamId), listAllProfiles(teamId)]);

  return (
    <AccountShell isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Users"
          description="Create accounts, approve sign-ups, manage roles, and assign profiles. Sort or filter any column from its header."
          action={
            <Link href="/admin/users/new" className={buttonVariants("primary", "md")}>
              <PlusIcon className="size-4" />
              New user
            </Link>
          }
        />

        <UsersTable
          users={users}
          adminId={admin.userId}
          profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
        />
      </div>
    </AccountShell>
  );
}
