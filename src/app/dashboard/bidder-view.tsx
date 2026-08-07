import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { FileTextIcon, CheckCircleIcon, TargetIcon, DollarSignIcon } from "@/components/icons";
import { getApplicationRate } from "@/lib/admin/rates";
import { getBidderSelfStats } from "@/lib/resumes/analytics";

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

/**
 * A bidder's personal dashboard: how much they've applied, how much of that was
 * approved / got a reply, and — the headline — what they've earned. Earnings
 * are paid per approved application at a rate a team admin/manager sets.
 */
export async function BidderDashboard({
  userId,
  email,
  teamId,
  teamName,
}: {
  userId: string;
  email: string;
  teamId?: string;
  teamName: string | null;
}) {
  const rate = await getApplicationRate(userId, teamId);
  const stats = await getBidderSelfStats({ userId, teamId, rate });
  const approvalRate = stats.applicationCount > 0 ? (stats.approvedCount / stats.applicationCount) * 100 : 0;

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

        {/* Earnings hero */}
        <Card className="border-success/20 bg-gradient-to-br from-success/10 via-card to-card">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <DollarSignIcon className="size-6" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">This week&apos;s earning</div>
                <div className="text-4xl font-bold tabular-nums text-foreground">{usd(stats.weeklyEarning)}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {stats.approvedThisWeek} approved this week · {usd(rate)} per approved application
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right">
              <div className="text-sm font-medium text-muted-foreground">All-time earned</div>
              <div className="text-2xl font-semibold tabular-nums text-foreground">{usd(stats.totalEarning)}</div>
              <div className="text-xs text-muted-foreground">from {stats.approvedCount} approved</div>
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
            label="Approved"
            value={String(stats.approvedCount)}
            icon={<CheckCircleIcon className="size-5" />}
            accent="success"
            hint={`${approvalRate.toFixed(0)}% approval rate`}
          />
          <StatCard
            label="Replies"
            value={String(stats.repliedCount)}
            icon={<TargetIcon className="size-5" />}
            accent="muted"
            hint="Reached the Reply stage"
          />
        </div>
      </div>
    </AppShell>
  );
}
