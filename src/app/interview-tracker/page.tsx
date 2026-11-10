import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getTeamContext } from "@/lib/auth/team-context";
import { listTrackedApplications, type TrackedApplication, type TrackerView } from "@/lib/interview-tracker/tracker";
import { INTERVIEW_STAGES, CLOSING_STAGES } from "@/lib/interview-tracker/stages";
import { searchApplications } from "@/lib/admin/application-search";
import { getPrimaryStatus, STATUS_LABEL } from "@/lib/resume-status";
import type { ResumeStatus } from "@/generated/prisma/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-badges";
import { ApplicationSearchBox } from "@/components/application-search-box";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MicIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { StageSelect } from "./stage-select";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function InterviewTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const [admin, params] = await Promise.all([requireSuperAdmin(), searchParams]);
  const teamId = (await getTeamContext())?.activeTeamId ?? undefined;
  const view: TrackerView = params.view === "closed" ? "closed" : "active";
  const query = (params.q ?? "").trim();

  const [tracked, results] = await Promise.all([
    listTrackedApplications(view, { teamId }),
    query ? searchApplications(query, { teamId }) : Promise.resolve(null),
  ]);

  return (
    <AppShell userEmail={admin.email} isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Interview tracker"
          description="Applications in the interview process, with your notes and meeting screenshots from each round. Got an interview request? Search for the application below and set its stage."
        />

        <Card>
          <CardHeader>
            <CardTitle>Find an application</CardTitle>
            <CardDescription>
              Searches every application, any date. Type any part of the company, title, candidate, bidder, or posting
              link — words in any order, small typos are fine.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ApplicationSearchBox action="/interview-tracker" query={query} hidden={view === "closed" ? { view } : undefined} />
            {results && <SearchResults query={query} results={results} />}
          </CardContent>
        </Card>

        <nav aria-label="Tracker view" className="flex gap-1 self-start rounded-lg border border-border p-1 text-sm">
          {(["active", "closed"] as const).map((v) => (
            <Link
              key={v}
              href={v === "active" ? "/interview-tracker" : "/interview-tracker?view=closed"}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1",
                v === view ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "active" ? "In progress" : "Closed"}
            </Link>
          ))}
        </nav>

        {tracked.length === 0 ? (
          <EmptyState
            icon={MicIcon}
            title={view === "active" ? "No interviews in progress" : "No closed interviews yet"}
            description={
              view === "active"
                ? "When an interview request comes in, find the application above and set its stage — it shows up here."
                : "Applications moved to Offer, Fail, or Canceled after interviewing appear here, with their notes."
            }
          />
        ) : (
          <StageBoard apps={tracked} stages={view === "active" ? INTERVIEW_STAGES : CLOSING_STAGES} />
        )}
      </div>
    </AppShell>
  );
}

/**
 * One column per stage, in pipeline order, each with its count — so it's clear
 * at a glance what's at which step. Columns sit side by side on wide screens
 * and stack on narrow ones; empty stages stay visible (as "None") so the
 * pipeline always reads the same.
 */
function StageBoard({ apps, stages }: { apps: TrackedApplication[]; stages: ResumeStatus[] }) {
  const byStage = new Map<ResumeStatus, TrackedApplication[]>(stages.map((s) => [s, []]));
  for (const a of apps) byStage.get(a.stage)?.push(a);

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${stages.length > 3 ? "15rem" : "20rem"}), 1fr))` }}
    >
      {stages.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return (
          <section key={stage} aria-label={STATUS_LABEL[stage]} className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3">
            <header className="flex items-center justify-between gap-2">
              <StatusPill status={stage} />
              <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
            </header>
            {items.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((a) => (
                  <TrackedCard key={a.id} app={a} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TrackedCard({ app }: { app: TrackedApplication }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <div className="flex min-w-0 flex-col">
        <Link href={`/interview-tracker/${app.id}`} className="truncate font-medium text-foreground hover:underline">
          {app.companyName}
        </Link>
        <span className="truncate text-sm text-muted-foreground">{app.jobTitle}</span>
        <span className="truncate text-xs text-muted-foreground">
          {app.candidateName ?? "No candidate"} · {app.bidderName}
        </span>
      </div>
      {app.lastNote ? (
        <p className="line-clamp-2 whitespace-pre-wrap rounded bg-muted/50 px-2 py-1 text-xs text-foreground">
          {app.lastNote.body || "Meeting screenshot"}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {app.noteCount} note{app.noteCount === 1 ? "" : "s"} · {formatDate(app.lastNote?.createdAt ?? app.updatedAt)}
        </span>
        <Link href={`/interview-tracker/${app.id}`} className="font-medium text-primary hover:underline">
          Open →
        </Link>
      </div>
      <StageSelect resumeId={app.id} current={app.stage} />
    </li>
  );
}

function SearchResults({ query, results }: { query: string; results: Awaited<ReturnType<typeof searchApplications>> }) {
  if (results.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SearchIcon className="size-4" />
        No application matches “{query}”.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {results.length === 50 ? "First 50 matches" : `${results.length} match${results.length === 1 ? "" : "es"}`} for “
        {query}”
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {results.map((r) => {
          const stage = getPrimaryStatus(r.statuses);
          const tracked = r.statuses.some((s) => INTERVIEW_STAGES.includes(s) || CLOSING_STAGES.includes(s));
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-foreground">
                  {r.companyName} <span className="font-normal text-muted-foreground">— {r.jobTitle}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.profileName ?? "No candidate"} · {r.userName} · {formatDate(r.appliedAt ?? r.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={stage} />
                {tracked ? (
                  <Link href={`/interview-tracker/${r.id}`} className="text-sm font-medium text-primary hover:underline">
                    Open
                  </Link>
                ) : (
                  <StageSelect resumeId={r.id} current={null} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
