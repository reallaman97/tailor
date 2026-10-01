import { requireTeamAdmin } from "@/lib/auth/team-context";
import { listAllUsers, listUnassignedSignups } from "@/lib/admin/users";
import { listAllProfiles } from "@/lib/admin/profiles";
import { TeamUsersView } from "./team-users-view";
import { AccountShell } from "@/components/account-shell";
import { PageHeader } from "@/components/page-header";

export default async function AdminUsersPage() {
  const admin = await requireTeamAdmin();
  const teamId = admin.activeTeamId ?? undefined;
  const [users, signups, profiles] = await Promise.all([
    listAllUsers(teamId),
    // Self-service sign-ups belong to no team until an admin approves them into one.
    listUnassignedSignups(),
    listAllProfiles(teamId),
  ]);

  const teamName = admin.teams.find((t) => t.id === admin.activeTeamId)?.name ?? null;

  return (
    <AccountShell isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Team users"
          description={
            teamName
              ? `Control ${teamName}'s members — approve new sign-ups, add people, set roles, approve access, reset passwords, or remove them from the team.`
              : "Control your team's members — approve new sign-ups, add people, set roles, approve access, reset passwords, or remove them from the team."
          }
        />

        <TeamUsersView
          users={users}
          signups={signups.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
          profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
          currentUserId={admin.userId}
        />
      </div>
    </AccountShell>
  );
}
