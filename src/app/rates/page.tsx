import { requireRatesManager } from "@/lib/auth/team-context";
import { listBidderRates } from "@/lib/admin/rates";
import { RatesShell } from "@/components/rates-shell";
import { RatesTable } from "./rates-table";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "@/components/icons";

export default async function RatesPage() {
  const ctx = await requireRatesManager();
  const teamId = ctx.activeTeamId!;
  const rows = await listBidderRates(teamId);
  const teamName = ctx.teams.find((t) => t.id === teamId)?.name ?? null;

  return (
    <RatesShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Bidder Rates"
          description={
            teamName
              ? `Set what each bidder earns per approved application in ${teamName}. Changes save automatically.`
              : "Set what each bidder earns per approved application. Changes save automatically."
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No bidders yet"
            description="Bidders added to this team will appear here, each with an editable rate."
          />
        ) : (
          <Card className="p-0">
            <RatesTable rows={rows} />
          </Card>
        )}
      </div>
    </RatesShell>
  );
}
