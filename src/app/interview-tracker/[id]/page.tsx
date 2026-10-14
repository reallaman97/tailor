import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getTrackerDetail, type TrackerNote } from "@/lib/interview-tracker/tracker";
import { STATUS_LABEL } from "@/lib/resume-status";
import { AppShell } from "@/components/app-shell";
import { StatusPill, StatusBadges } from "@/components/status-badges";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon, ExternalLinkIcon, TrashIcon } from "@/components/icons";
import { StageSelect } from "../stage-select";
import { NoteForm } from "../note-form";
import { deleteTrackerNoteAction } from "../actions";

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function TrackerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [admin, { id }] = await Promise.all([requireSuperAdmin(), params]);
  const app = await getTrackerDetail(id);
  if (!app) notFound();

  return (
    <AppShell userEmail={admin.email} isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {app.companyName} <span className="text-muted-foreground">—</span> {app.jobTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {app.candidateName ?? "No candidate"} · applied by {app.bidderName} ·{" "}
              {formatDateTime(app.appliedAt ?? app.createdAt)}
            </p>
            <div className="mt-1">
              <StatusBadges statuses={app.statuses} />
            </div>
          </div>
          <Link href="/interview-tracker" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Back to tracker
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StageSelect resumeId={app.id} current={app.stage} />
          {app.hasResume && (
            <a href={`/api/resumes/${app.id}/pdf`} className={buttonVariants("outline", "sm")}>
              <DownloadIcon className="size-4" />
              Resume PDF
            </a>
          )}
          <a href={`/api/resumes/${app.id}/job-description`} className={buttonVariants("outline", "sm")}>
            <DownloadIcon className="size-4" />
            Job description
          </a>
          {app.jobLink && (
            <a href={app.jobLink} target="_blank" rel="noopener noreferrer" className={buttonVariants("outline", "sm")}>
              <ExternalLinkIcon className="size-4" />
              Job posting
            </a>
          )}
          <Link href={`/resumes/${app.id}`} className={buttonVariants("ghost", "sm")}>
            Application details
          </Link>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Add a note</CardTitle>
              <CardDescription>
                After each round: what happened, who you met, and the next step. Attach a meeting screenshot to remember
                the interviewers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NoteForm resumeId={app.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>
                {app.notes.length === 0 ? "No notes yet." : `${app.notes.length} note${app.notes.length === 1 ? "" : "s"}, newest first.`}
              </CardDescription>
            </CardHeader>
            {app.notes.length > 0 && (
              <CardContent>
                <ol className="flex flex-col gap-4">
                  {app.notes.map((n) => (
                    <NoteItem key={n.id} note={n} />
                  ))}
                </ol>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function NoteItem({ note }: { note: TrackerNote }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {note.stage && <StatusPill status={note.stage} dense />}
        <span>{formatDateTime(note.createdAt)}</span>
        {note.authorName && <span>· {note.authorName}</span>}
        <div className="ml-auto">
          <ConfirmDialog
            triggerContent={<TrashIcon className="size-4" />}
            triggerLabel="Delete note"
            triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete this note?"
            description={`This removes the note${note.hasImage ? " and its screenshot" : ""} from the history for good.`}
            action={deleteTrackerNoteAction.bind(null, note.id)}
          />
        </div>
      </div>
      {note.body && <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>}
      {note.hasImage && (
        <a href={`/api/interview-tracker/notes/${note.id}/image`} target="_blank" rel="noopener noreferrer" className="self-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, per-note image served from our own route */}
          <img
            src={`/api/interview-tracker/notes/${note.id}/image`}
            alt={`Meeting screenshot${note.stage ? ` — ${STATUS_LABEL[note.stage]}` : ""}`}
            loading="lazy"
            className="max-h-64 w-auto rounded-md border border-border object-contain"
          />
        </a>
      )}
    </li>
  );
}
