import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import {
  listApplicationChecks,
  WORK_STYLE_OPTIONS,
  type CheckedApplication,
  type CheckStatus,
} from "@/lib/checks/application-checks";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CriteriaForm } from "./criteria-form";
import { ChecksControls } from "./checks-controls";

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDateParam(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function dayLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_BADGE: Record<CheckStatus, { label: string; variant: "success" | "destructive" | "secondary" | "warning" }> = {
  PASS: { label: "Pass", variant: "success" },
  FAIL: { label: "Fail", variant: "destructive" },
  UNCHECKED: { label: "Unchecked", variant: "secondary" },
  STALE: { label: "Stale", variant: "warning" },
};

function Tile({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" | "muted" }) {
  const color = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Crit({ ok, text }: { ok: boolean | null; text: string | null }) {
  if (ok === null) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className={ok ? "text-success" : "text-destructive"}>
      {ok ? "✓" : "✗"} {text || (ok ? "" : "no")}
    </span>
  );
}

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; bidder?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { from, to, bidder } = await searchParams;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultFrom = new Date(todayUtc);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6); // last 7 days

  const fromDate = parseDateParam(from) ?? defaultFrom;
  const toDate = parseDateParam(to) ?? todayUtc;
  const toExclusive = new Date(toDate.getTime() + 86_400_000);
  const bidderId = bidder || "";

  const [{ criteria, applications, summary }, bidderRows] = await Promise.all([
    listApplicationChecks({ from: fromDate, to: toExclusive, bidderId: bidderId || undefined }),
    db.user.findMany({
      where: { role: "BIDDER" },
      select: { id: true, username: true, email: true },
      orderBy: { username: "asc" },
    }),
  ]);
  const bidders = bidderRows.map((b) => ({ id: b.id, name: b.username ?? b.email }));

  // Group by day (already desc by createdAt), sort each day by bidder then time.
  const orderedDays: string[] = [];
  const byDay = new Map<string, CheckedApplication[]>();
  for (const a of applications) {
    if (!byDay.has(a.day)) {
      byDay.set(a.day, []);
      orderedDays.push(a.day);
    }
    byDay.get(a.day)!.push(a);
  }
  for (const list of byDay.values()) {
    list.sort((x, y) => x.bidderName.localeCompare(y.bidderName) || y.createdAt.getTime() - x.createdAt.getTime());
  }

  const checked = summary.passed + summary.failed;
  const passRate = checked > 0 ? Math.round((summary.passed / checked) * 100) : 0;

  return (
    <AppShell userEmail={admin.email} isSuperAdmin>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Application checks"
          description="Verify each bidder's applications, day by day, against your criteria — checked in batches to keep API calls minimal."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Criteria</CardTitle>
              <CardDescription>What makes an application “right”. Editable — these defaults are the baseline.</CardDescription>
            </CardHeader>
            <CardContent>
              <CriteriaForm criteria={criteria} workStyleOptions={WORK_STYLE_OPTIONS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                {ymd(fromDate)} → {ymd(toDate)}
                {bidderId ? ` · ${bidders.find((b) => b.id === bidderId)?.name ?? "bidder"}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Tile label="Applications" value={String(summary.total)} />
                <Tile label="Pass" value={String(summary.passed)} accent="success" />
                <Tile label="Fail" value={String(summary.failed)} accent="destructive" />
                <Tile label="Unchecked" value={String(summary.unchecked)} accent="muted" />
                <Tile label="Stale" value={String(summary.stale)} accent="muted" />
                <Tile label="Pass rate" value={`${passRate}%`} />
              </div>
              {(summary.unchecked > 0 || summary.stale > 0) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {summary.unchecked + summary.stale} application{summary.unchecked + summary.stale === 1 ? "" : "s"} still
                  need checking — click <span className="font-medium text-foreground">Run checks</span> below.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Applications by day</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ChecksControls from={ymd(fromDate)} to={ymd(toDate)} bidderId={bidderId} bidders={bidders} />

            {applications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No applications in this range.
              </div>
            ) : (
              orderedDays.map((day) => {
                const list = byDay.get(day)!;
                const dayPass = list.filter((a) => a.status === "PASS").length;
                const dayFail = list.filter((a) => a.status === "FAIL").length;
                const dayPending = list.filter((a) => a.status === "UNCHECKED" || a.status === "STALE").length;
                return (
                  <div key={day}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{dayLabel(day)}</h3>
                      <span className="text-xs text-muted-foreground">{list.length} total</span>
                      {dayPass > 0 && <Badge variant="success">{dayPass} pass</Badge>}
                      {dayFail > 0 && <Badge variant="destructive">{dayFail} fail</Badge>}
                      {dayPending > 0 && <Badge variant="secondary">{dayPending} pending</Badge>}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-max text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-left">
                            <th className="p-2.5 font-medium text-muted-foreground">Bidder</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Company</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Job title</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Verdict</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Country</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Work style</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Category</th>
                            <th className="p-2.5 font-medium text-muted-foreground">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((a) => {
                            const badge = STATUS_BADGE[a.status];
                            return (
                              <tr key={a.id} className="border-b border-border last:border-0 align-top">
                                <td className="p-2.5 font-medium text-foreground whitespace-nowrap">{a.bidderName}</td>
                                <td className="p-2.5 whitespace-nowrap">
                                  {a.jobLink ? (
                                    <a href={a.jobLink} target="_blank" rel="noopener" className="hover:text-primary hover:underline">
                                      {a.companyName}
                                    </a>
                                  ) : (
                                    a.companyName
                                  )}
                                </td>
                                <td className="p-2.5">{a.jobTitle}</td>
                                <td className="p-2.5">
                                  <Badge variant={badge.variant}>{badge.label}</Badge>
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <Crit ok={a.countryOk} text={a.detectedCountry} />
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <Crit ok={a.remoteOk} text={a.detectedWorkStyle} />
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  <Crit ok={a.categoryOk} text={a.detectedCategory} />
                                </td>
                                <td className="p-2.5 text-muted-foreground max-w-[22rem]">{a.reason ?? "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
