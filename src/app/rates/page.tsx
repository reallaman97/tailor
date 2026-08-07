import { requireRatesManager } from "@/lib/auth/team-context";
import { listBidderRates, getTeamWeeklyEarnings } from "@/lib/admin/rates";
import { RatesShell } from "@/components/rates-shell";
import { RatesTable } from "./rates-table";
import { WeeklyEarningsTable } from "./weekly-earnings-table";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "@/components/icons";

export default async function RatesPage() {
  const ctx = await requireRatesManager();
  const teamId = ctx.activeTeamId!;
  const [rows, weekly] = await Promise.all([listBidderRates(teamId), getTeamWeeklyEarnings(teamId)]);
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
          <>
            <Card>
              <CardHeader>
                <CardTitle>Rates &amp; totals</CardTitle>
                <CardDescription>Set each bidder&apos;s pay per approved application. Changes save automatically.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <RatesTable rows={rows} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly earnings</CardTitle>
                <CardDescription>
                  What each bidder earned per week (approved applications × their rate) over the last {weekly.weeks.length} weeks.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <WeeklyEarningsTable data={weekly} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RatesShell>
  );
}
