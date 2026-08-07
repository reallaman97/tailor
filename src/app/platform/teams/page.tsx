import { requireServiceAdmin } from "@/lib/auth/team-context";
import { listTeams } from "@/lib/admin/teams";
import { PlatformShell } from "@/components/platform-shell";
import { PageHeader } from "@/components/page-header";
import { TeamsView } from "./teams-view";

export default async function PlatformTeamsPage() {
  await requireServiceAdmin();
  const teams = await listTeams();

  return (
    <PlatformShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Teams"
          description="Create and manage the teams (tenants) on the platform. Switch into any team from the top-bar selector to administer it."
        />
        <TeamsView teams={teams.map((t) => ({ id: t.id, name: t.name, active: t.active, memberCount: t.memberCount }))} />
      </div>
    </PlatformShell>
  );
}
