import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart } from "@/components/line-chart";
import { FileTextIcon, CheckCircleIcon, TargetIcon, DollarSignIcon } from "@/components/icons";
import { getApplicationRate } from "@/lib/admin/rates";
import { getBidderSelfStats, getBidderSelfCounts, normalizeBidderPeriod } from "@/lib/resumes/analytics";
import { BidderPeriodToggle } from "./bidder-period-toggle";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const ACCENT = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  muted: "text-muted-foreground bg-muted",
} as const;

function StatCard({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: keyof typeof ACCENT;
  hint?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${ACCENT[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
        {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
      </div>
    </Card>
  );
}

const PERIOD_NOUN: Record<string, string> = { week: "this week", month: "this month", year: "this year" };

/**
 * A bidder's personal dashboard: today's / this week's earnings up top, headline
 * counts, and a per-period (week / month / year) breakdown of their application
 * counts as both a chart and a table.
 */
export async function BidderDashboard({
  userId,
  email,
  teamId,
  teamName,
  period,
}: {
  userId: string;
  email: string;
  teamId?: string;
  teamName: string | null;
  period?: string;
}) {
  const activePeriod = normalizeBidderPeriod(period);
  const rate = await getApplicationRate(userId, teamId);
  const [stats, counts] = await Promise.all([
    getBidderSelfStats({ userId, teamId, rate }),
    getBidderSelfCounts({ userId, teamId, period: activePeriod }),
  ]);
  const completionRate = stats.applicationCount > 0 ? (stats.completedCount / stats.applicationCount) * 100 : 0;

  return (
    <AppShell userEmail={email} isSuperAdmin={false}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Your Dashboard"
          description={
            teamName
              ? `Your applications and earnings in ${teamName}.`
              : "Your applications and earnings at a glance."
          }
        />

        {/* Earnings hero — today up top, with this-week and all-time alongside */}
        <Card className="border-success/20 bg-gradient-to-br from-success/10 via-card to-card">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <DollarSignIcon className="size-6" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Today&apos;s earning</div>
                <div className="text-4xl font-bold tabular-nums text-foreground">{usd(stats.todayEarning)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {stats.completedToday} completed today · {usd(rate)} per completed application
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <div>
                <div className="text-sm font-medium text-muted-foreground">This week</div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">{usd(stats.weeklyEarning)}</div>
                <div className="text-xs text-muted-foreground">{stats.completedThisWeek} completed</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">All-time</div>
                <div className="text-2xl font-semibold tabular-nums text-foreground">{usd(stats.totalEarning)}</div>
                <div className="text-xs text-muted-foreground">{stats.completedCount} completed</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Counts */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Applications"
            value={String(stats.applicationCount)}
            icon={<FileTextIcon className="size-5" />}
            accent="primary"
            hint="Total you've logged"
          />
          <StatCard
            label="Completed"
            value={String(stats.completedCount)}
            icon={<CheckCircleIcon className="size-5" />}
            accent="success"
            hint={`With proof screenshot · ${completionRate.toFixed(0)}%`}
          />
          <StatCard
            label="Replies"
            value={String(stats.repliedCount)}
            icon={<TargetIcon className="size-5" />}
            accent="muted"
            hint="Reached the Reply stage"
          />
        </div>

        {/* Application counts over time — week / month / year */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Completed applications over time</CardTitle>
                <CardDescription>
                  Completed applications (with a proof screenshot, not rejected) per {counts.unitNoun},{" "}
                  {PERIOD_NOUN[activePeriod]} — {counts.rangeLabel}.
                </CardDescription>
              </div>
              <BidderPeriodToggle active={activePeriod} />
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total {PERIOD_NOUN[activePeriod]}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{counts.total}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Avg / {counts.unitNoun}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {counts.perUnitAverage.toFixed(1)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Busiest {counts.unitNoun}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {counts.busiestLabel ? counts.busiestCount : "—"}
                </div>
                {counts.busiestLabel && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{counts.busiestLabel}</div>
                )}
              </div>
            </div>

            {counts.total === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No completed applications {PERIOD_NOUN[activePeriod]} yet.
              </div>
            ) : (
              <>
                <LineChart
                  labels={counts.buckets.map((b) => b.label)}
                  series={[{ label: "Applications", color: "var(--primary)", values: counts.buckets.map((b) => b.count) }]}
                />

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{counts.unitNoun === "month" ? "Month" : "Day"}</TableHead>
                        <TableHead className="text-right">Applications</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {counts.buckets.map((b) => (
                        <TableRow key={b.key}>
                          <TableCell className="font-medium text-foreground">{b.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-semibold text-foreground">Total</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-foreground">
                          {counts.total}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
