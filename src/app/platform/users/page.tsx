import { requireServiceAdmin } from "@/lib/auth/team-context";
import { listPlatformUsers } from "@/lib/admin/users";
import { listTeams } from "@/lib/admin/teams";
import { PlatformShell } from "@/components/platform-shell";
import { PageHeader } from "@/components/page-header";
import { PlatformUsersView } from "./platform-users-view";

export default async function PlatformUsersPage() {
  const ctx = await requireServiceAdmin();
  const [users, teams] = await Promise.all([listPlatformUsers(), listTeams()]);

  return (
    <PlatformShell wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Users"
          description="Every account on the platform. Create users, move them between teams, set roles, approve access, reset passwords, or delete accounts — all from here."
        />
        <PlatformUsersView
          users={users}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          currentUserId={ctx.userId}
        />
      </div>
    </PlatformShell>
  );
}
