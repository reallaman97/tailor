import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getInboxEmail } from "@/lib/inbox/store";
import { CATEGORY_LABEL, CATEGORY_VARIANT, WORK_MODE_LABEL, NEXT_STEP_LABEL } from "@/lib/inbox/labels";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmailControls } from "./email-controls";
import { ReplyPanel } from "./reply-panel";

export default async function InboxEmailPage({ params }: { params: Promise<{ emailId: string }> }) {
  const [admin, { emailId }] = await Promise.all([requireSuperAdmin(), params]);
  const email = await getInboxEmail(emailId);
  if (!email) notFound();

  const remoteOrUnknown = email.workMode === "REMOTE" || email.workMode === "UNKNOWN";
  const isResumeRequest = email.category === "RESUME_REQUEST" && remoteOrUnknown;
  const wantsReply = email.needsAttention || isResumeRequest || email.category === "CONVERSATION";

  return (
    <AppShell userEmail={admin.email} isSuperAdmin wide>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={CATEGORY_VARIANT[email.category]}>
                {email.category === "NEXT_STEP" && email.nextStepKind ? NEXT_STEP_LABEL[email.nextStepKind] : CATEGORY_LABEL[email.category]}
              </Badge>
              <Badge variant={email.workMode === "REMOTE" ? "success" : "outline"}>{WORK_MODE_LABEL[email.workMode]}</Badge>
              {email.appliedUpdate && <Badge variant="default">{email.appliedUpdate}</Badge>}
              <span className="text-xs text-muted-foreground">
                {email.classifiedBy === "manual"
                  ? "Sorted by you"
                  : `Sorted by ${email.classifiedBy === "llm" ? "AI" : "rules"} · ${Math.round(email.confidence * 100)}% sure`}
              </span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{email.subject}</h1>
            <p className="text-sm text-muted-foreground">
              From {email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress} ·{" "}
              {email.receivedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              {email.mailboxEmail ? ` · to ${email.mailboxEmail}` : ""}
            </p>
            {email.summary && <p className="text-sm text-foreground">{email.summary}</p>}
          </div>
          <Link
            href={`/interview-tracker/inbox?profile=${encodeURIComponent(email.profileId)}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to inbox
          </Link>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email</CardTitle>
              </CardHeader>
              <CardContent>
                {email.body ? (
                  <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                    {email.body}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The text of this email isn&apos;t kept — confirmations, job alerts and other routine mail are filed by subject only.
                  </p>
                )}
              </CardContent>
            </Card>

            {wantsReply && (
              <Card>
                <CardHeader>
                  <CardTitle>Reply</CardTitle>
                  <CardDescription>
                    A suggested reply — edit it, then send. It goes from {email.mailboxEmail ?? "this profile's Gmail"} as a reply in the
                    same thread.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ReplyPanel
                    emailId={email.id}
                    to={email.replyTo ?? email.fromAddress}
                    initialReply={email.suggestedReply}
                    autoSuggest={wantsReply}
                    isResumeRequest={isResumeRequest}
                    prepareStatus={email.prepareStatus}
                    prepareError={email.prepareError}
                    preparedLabel={email.preparedResume ? `${email.preparedResume.jobTitle} at ${email.preparedResume.companyName}` : null}
                    sentAt={email.replySentAt?.toISOString() ?? null}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sorting</CardTitle>
              <CardDescription>Fix anything the automatic sorting got wrong.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailControls
                emailId={email.id}
                profileId={email.profileId}
                category={email.category}
                workMode={email.workMode}
                status={email.status}
                application={email.application}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
