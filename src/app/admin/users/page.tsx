import { requireSuperAdmin } from "@/lib/auth/require-user";
import { listAllUsers } from "@/lib/admin/users";
import { listAllProfiles } from "@/lib/admin/profiles";
import { UsersTable } from "./users-table";
import { AdminShell } from "@/components/admin-shell";
import { PageHeader } from "@/components/page-header";

export default async function AdminUsersPage() {
  const admin = await requireSuperAdmin();
  const [users, profiles] = await Promise.all([listAllUsers(), listAllProfiles()]);

  return (
    <AdminShell userEmail={admin.email}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Users"
          description="Approve new sign-ups, manage roles, and assign profiles. Sort or filter any column from its header."
        />

        <UsersTable
          users={users}
          adminId={admin.id}
          profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
        />
      </div>
    </AdminShell>
  );
}
