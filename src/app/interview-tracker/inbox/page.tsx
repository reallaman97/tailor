import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getTeamContext } from "@/lib/auth/team-context";
import { listInboxProfiles, listInboxEmails, INBOX_TABS, type InboxTab, type InboxEmailRow } from "@/lib/inbox/store";
import { CATEGORY_LABEL, CATEGORY_VARIANT, WORK_MODE_LABEL, NEXT_STEP_LABEL } from "@/lib/inbox/labels";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MailIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { CheckNowButton } from "./check-now-button";
import { ConnectForm } from "./connect-form";
import { AutoPrepare } from "./auto-prepare";
import { disconnectMailboxAction } from "./actions";

export const maxDuration = 60;

function formatWhen(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ profile?: string; tab?: string }> }) {
  const [admin, params] = await Promise.all([requireSuperAdmin(), searchParams]);
  const teamId = (await getTeamContext())?.activeTeamId ?? undefined;
  const profiles = await listInboxProfiles(teamId);
  const profile = profiles.find((p) => p.id === params.profile) ?? profiles[0];
  const tab = (INBOX_TABS.find((t) => t.value === params.tab)?.value ?? "attention") as InboxTab;
  const data = profile?.mailbox ? await listInboxEmails(profile.id, tab) : null;
  const pendingPrepares = data?.rows.filter((r) => r.prepareStatus === "pending").map((r) => r.id) ?? [];
  const href = (p: string, t: InboxTab = tab) => `/interview-tracker/inbox?profile=${encodeURIComponent(p)}&tab=${t}`;

  return (
    <AppShell userEmail={admin.email} isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Inbox"
          description="Each profile's Gmail, read for application updates: rejections and next steps update the Interview tracker, and emails that need a reply get a suggested one — sent from that profile's Gmail when you click Send."
        />

        {profiles.length === 0 ? (
          <EmptyState icon={MailIcon} title="No profiles yet" description="Create a profile first, then connect its Gmail here." />
        ) : (
          <>
            <nav aria-label="Profiles" className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  href={href(p.id)}
                  aria-current={p.id === profile?.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                    p.id === profile?.id ? "border-primary bg-primary/5 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.name}
                  {!p.mailbox && <span className="text-xs text-muted-foreground">· not connected</span>}
                  {p.openAttention > 0 && <Badge variant="warning">{p.openAttention}</Badge>}
                  {p.mailbox?.status === "error" && <Badge variant="destructive">!</Badge>}
                </Link>
              ))}
            </nav>

            {profile && (
              <Card>
                <CardHeader>
                  <CardTitle>{profile.name}&apos;s Gmail</CardTitle>
                  <CardDescription>
                    {profile.mailbox
                      ? `${profile.mailbox.email} · ${profile.mailbox.lastCheckedAt ? `last checked ${formatWhen(profile.mailbox.lastCheckedAt)}` : "not checked yet — the first check reads the last two weeks"}`
                      : "Connect with an app password: turn on 2-Step Verification for this Google account, then create one under Google Account → Security → App passwords. Make sure IMAP is enabled in Gmail settings."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {profile.mailbox?.status === "error" && profile.mailbox.lastError && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{profile.mailbox.lastError}</p>
                  )}
                  {profile.mailbox ? (
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <CheckNowButton profileId={profile.id} />
                      <div className="flex items-center gap-2">
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Change app password</summary>
                          <div className="mt-3 w-[min(36rem,90vw)]">
                            <ConnectForm profileId={profile.id} defaultEmail={profile.mailbox.email} />
                          </div>
                        </details>
                        <ConfirmDialog
                          triggerContent="Disconnect"
                          triggerClassName="text-muted-foreground hover:text-destructive"
                          title="Disconnect this Gmail?"
                          description="Mail stops being read for this profile. Emails already filed stay here; reconnect any time."
                          confirmLabel="Disconnect"
                          action={disconnectMailboxAction.bind(null, profile.id)}
                        />
                      </div>
                    </div>
                  ) : (
                    <ConnectForm profileId={profile.id} />
                  )}
                </CardContent>
              </Card>
            )}

            {profile && data && (
              <>
                <nav aria-label="Mail lists" className="flex flex-wrap gap-1 rounded-lg border border-border p-1 text-sm">
                  {INBOX_TABS.map((t) => (
                    <Link
                      key={t.value}
                      href={href(profile.id, t.value)}
                      aria-current={t.value === tab ? "page" : undefined}
                      title={t.hint}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1",
                        t.value === tab ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t.label}
                      <span className="tabular-nums text-xs text-muted-foreground">{data.counts[t.value]}</span>
                    </Link>
                  ))}
                </nav>
                <p className="-mt-3 text-xs text-muted-foreground">{INBOX_TABS.find((t) => t.value === tab)?.hint}</p>

                <AutoPrepare emailIds={pendingPrepares} />

                {data.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing here.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                    {data.rows.map((r) => (
                      <EmailRow key={r.id} row={r} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmailRow({ row }: { row: InboxEmailRow }) {
  const preparing = row.prepareStatus === "pending" || row.prepareStatus?.startsWith("building:");
  return (
    <li>
      <Link href={`/interview-tracker/inbox/${row.id}`} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-muted/40">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={CATEGORY_VARIANT[row.category]}>
            {row.category === "NEXT_STEP" && row.nextStepKind ? NEXT_STEP_LABEL[row.nextStepKind] : CATEGORY_LABEL[row.category]}
          </Badge>
          {(row.category === "RECRUITER_OUTREACH" || row.category === "RESUME_REQUEST") && (
            <Badge variant={row.workMode === "REMOTE" ? "success" : "outline"}>{WORK_MODE_LABEL[row.workMode]}</Badge>
          )}
          {row.appliedUpdate && <Badge variant="default">{row.appliedUpdate}</Badge>}
          {row.needsReview && row.status === "open" && <Badge variant="warning">Review</Badge>}
          {row.replySentAt && <Badge variant="success">Replied</Badge>}
          {row.status === "dismissed" && <Badge variant="outline">Dismissed</Badge>}
          {preparing && <Badge variant="secondary">Preparing resume…</Badge>}
          {row.prepareStatus === "ready" && !row.replySentAt && <Badge variant="secondary">Resume ready</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">{formatWhen(row.receivedAt)}</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-foreground">{row.subject}</span>
          <span className="text-xs text-muted-foreground">{row.fromName ? `${row.fromName} <${row.fromAddress}>` : row.fromAddress}</span>
        </div>
        {row.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{row.summary}</p>}
        <p className="text-xs text-muted-foreground">
          {row.application
            ? `Application: ${row.application.companyName} — ${row.application.jobTitle}`
            : [row.companyName, row.jobTitle].filter(Boolean).join(" — ") || "No application linked"}
          {row.classifiedBy === "llm" ? " · sorted by AI" : row.classifiedBy === "manual" ? " · sorted by you" : ""}
        </p>
      </Link>
    </li>
  );
}
