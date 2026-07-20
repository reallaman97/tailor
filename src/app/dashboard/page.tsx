import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getDashboardAnalytics } from "@/lib/resumes/analytics";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart } from "@/components/line-chart";
import { ROLE_TRACK_LABEL, SOURCE_LABEL } from "@/lib/resume-status";

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

export default async function DashboardPage() {
  const admin = await requireSuperAdmin();
  const { overview, byRoleTrack, bySource, today, weekly } = await getDashboardAnalytics();
  const weekLabels = weekly.map((w) => weekLabel(w.weekStart));

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard"
          description="Every user's job search, at a glance — numbers update automatically as applications are tracked."
        />

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
              <StatRow label="Ghosted" value={String(overview.ghosted)} />
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
