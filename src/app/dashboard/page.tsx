import type { ReactNode } from "react";
import { requireTeamContext } from "@/lib/auth/team-context";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { BidderDashboard } from "./bidder-view";
import {
  getDashboardAnalytics,
  getBidderApplicationCounts,
  type BidderCountsGranularity,
} from "@/lib/resumes/analytics";
import { listAllProfiles } from "@/lib/admin/profiles";
import { ProfileFilter } from "./profile-filter";
import { BidderSection } from "./bidder-section";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart } from "@/components/line-chart";
import { FileTextIcon, TargetIcon, CalendarIcon, AlertCircleIcon } from "@/components/icons";
import { ROLE_TRACK_LABEL, SOURCE_LABEL } from "@/lib/resume-status";

const ACCENT_CLASSES = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  muted: "text-muted-foreground bg-muted",
} as const;

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: keyof typeof ACCENT_CLASSES;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums text-foreground">{value}</div>
      </div>
    </Card>
  );
}

/** Parses a YYYY-MM-DD query param into a UTC date, or undefined if absent/invalid. */
function parseDateParam(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-md px-3 py-2 ${highlight ? "bg-warning/10" : ""}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; g?: string; from?: string; to?: string; period?: string }>;
}) {
  // /dashboard is shared: team admins get the org-wide aggregate below; a
  // bidder gets their personal applications-and-earnings view instead. The edge
  // middleware keeps non-resume roles (callers/managers) out entirely.
  const ctx = await requireTeamContext();
  const isAdmin = ctx.isServiceAdmin || hasTeamAdminPower(ctx.teamRole);
  if (!isAdmin) {
    const activeTeamName = ctx.teams.find((t) => t.id === ctx.activeTeamId)?.name ?? null;
    const { period } = await searchParams;
    return (
      <BidderDashboard
        userId={ctx.userId}
        email={ctx.email}
        teamId={ctx.activeTeamId ?? undefined}
        teamName={activeTeamName}
        period={period}
      />
    );
  }
  const admin = ctx;
  const teamId = admin.activeTeamId ?? undefined;
  const { profile: requestedProfileId, g, from, to } = await searchParams;

  const profiles = await listAllProfiles(teamId);
  const selectedProfile = requestedProfileId ? profiles.find((p) => p.id === requestedProfileId) : undefined;
  const selectedProfileId = selectedProfile?.id;

  // Default to a daily view (last 14 days) so today's and this week's activity
  // is visible per-day up to the current date; Week/Month remain one click away.
  const granularity: BidderCountsGranularity = g === "week" || g === "month" ? g : "day";

  const [{ overview, byProfile, byRoleTrack, bySource, today, weekly }, bidderCounts] = await Promise.all([
    getDashboardAnalytics({ profileId: selectedProfileId, teamId }),
    getBidderApplicationCounts({
      granularity,
      from: parseDateParam(from),
      to: parseDateParam(to),
      profileId: selectedProfileId,
      teamId,
    }),
  ]);
  const weekLabels = weekly.map((w) => weekLabel(w.weekStart));

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader
            title="Dashboard"
            description={
              selectedProfile
                ? `${selectedProfile.fullName ?? "Untitled profile"}'s job search, at a glance — numbers update automatically as applications are tracked.`
                : "Every profile's job search, at a glance — numbers update automatically as applications are tracked."
            }
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Profile</label>
            <ProfileFilter
              profiles={profiles.map((p) => ({ id: p.id, fullName: p.fullName }))}
              selectedProfileId={selectedProfileId}
            />
          </div>
        </div>

        {/* Headline KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total applications"
            value={String(overview.total)}
            icon={<FileTextIcon className="size-5" />}
            accent="primary"
          />
          <StatCard
            label="Positive response rate"
            value={pct(overview.positiveResponseRate)}
            icon={<TargetIcon className="size-5" />}
            accent="success"
          />
          <StatCard
            label="Awaiting response"
            value={String(overview.awaitingResponse)}
            icon={<CalendarIcon className="size-5" />}
            accent="muted"
          />
          <StatCard
            label="Needs follow-up today"
            value={String(overview.needsFollowUpToday)}
            icon={<AlertCircleIcon className="size-5" />}
            accent="warning"
          />
        </div>

        {/* Application counts per bidder (day / week / month / range) */}
        <BidderSection data={bidderCounts} />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              <StatRow label="Total applications" value={String(overview.total)} />
              <StatRow label="Awaiting response" value={String(overview.awaitingResponse)} />
              <StatRow label="Positive responses (Reply + Interview + Offer)" value={String(overview.positiveResponses)} />
              <StatRow label="Rejected" value={String(overview.rejected)} />
              <StatRow label="Failed (retry these!)" value={String(overview.failed)} />
              <StatRow label="Positive response rate" value={pct(overview.positiveResponseRate)} />
              <StatRow label="Need follow-up today" value={String(overview.needsFollowUpToday)} highlight />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today</CardTitle>
              <CardDescription>Status changes recorded today</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              <StatRow label="Positive responses" value={String(today.positiveResponses)} />
              <StatRow label="Scheduled" value={String(today.scheduled)} />
              <StatRow label="Rejected" value={String(today.rejected)} />
            </CardContent>
          </Card>
        </div>

        {!selectedProfile && (
          <Card>
            <CardHeader>
              <CardTitle>By profile</CardTitle>
              <CardDescription>
                Every tracked candidate&apos;s job search, broken out individually — pick one above to see its full
                dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Awaiting response</TableHead>
                    <TableHead>Positive</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Positive %</TableHead>
                    <TableHead>Needs follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProfile.map((row) => (
                    <TableRow key={row.profileId ?? "__none__"}>
                      <TableCell className="font-medium text-foreground">
                        {row.profileId ? (
                          <a href={`/dashboard?profile=${row.profileId}`} className="hover:text-primary hover:underline">
                            {row.profileName ?? "Untitled profile"}
                          </a>
                        ) : (
                          "No profile assigned"
                        )}
                      </TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.awaitingResponse}</TableCell>
                      <TableCell>{row.positiveResponses}</TableCell>
                      <TableCell>{row.rejected}</TableCell>
                      <TableCell>{row.pending}</TableCell>
                      <TableCell>{pct(row.positiveRate)}</TableCell>
                      <TableCell>
                        {row.needsFollowUp > 0 ? (
                          <span className="font-medium text-warning">{row.needsFollowUp}</span>
                        ) : (
                          row.needsFollowUp
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Conversion by role track</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role track</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Positive</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Positive %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRoleTrack.map((row) => (
                  <TableRow key={row.roleTrack}>
                    <TableCell className="font-medium text-foreground">
                      {ROLE_TRACK_LABEL[row.roleTrack]}
                    </TableCell>
                    <TableCell>{row.applied}</TableCell>
                    <TableCell>{row.positive}</TableCell>
                    <TableCell>{row.rejected}</TableCell>
                    <TableCell>{row.pending}</TableCell>
                    <TableCell>{pct(row.positiveRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversion by source</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Positive</TableHead>
                  <TableHead>Positive %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySource.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="font-medium text-foreground">{SOURCE_LABEL[row.source]}</TableCell>
                    <TableCell>{row.applied}</TableCell>
                    <TableCell>{row.positive}</TableCell>
                    <TableCell>{pct(row.positiveRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend (last 6 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              labels={weekLabels}
              series={[
                {
                  label: "Positive responses",
                  color: "var(--primary)",
                  values: weekly.map((w) => w.positiveResponses),
                },
                { label: "Scheduled", color: "var(--warning)", values: weekly.map((w) => w.scheduled) },
                { label: "Rejected", color: "var(--destructive)", values: weekly.map((w) => w.rejected) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly breakdown</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left font-medium text-muted-foreground">Week of</th>
                  {weekLabels.map((label) => (
                    <th key={label} className="p-3 text-right font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-medium text-foreground">Positive responses</td>
                  {weekly.map((w) => (
                    <td key={w.weekStart} className="p-3 text-right">
                      {w.positiveResponses}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-medium text-foreground">Scheduled</td>
                  {weekly.map((w) => (
                    <td key={w.weekStart} className="p-3 text-right">
                      {w.scheduled}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">Rejected</td>
                  {weekly.map((w) => (
                    <td key={w.weekStart} className="p-3 text-right">
                      {w.rejected}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
