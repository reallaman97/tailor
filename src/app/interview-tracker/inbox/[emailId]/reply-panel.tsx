"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DownloadIcon, SparklesIcon } from "@/components/icons";

/**
 * The suggested reply, editable, and Send — from the profile's own Gmail, as a
 * reply in the same thread. For resume requests the tailored Word resume is
 * prepared automatically and attached. Nothing is sent without clicking Send.
 */
export function ReplyPanel({
  emailId,
  to,
  initialReply,
  autoSuggest,
  isResumeRequest,
  prepareStatus,
  prepareError,
  preparedLabel,
  sentAt,
}: {
  emailId: string;
  to: string;
  initialReply: string | null;
  autoSuggest: boolean;
  isResumeRequest: boolean;
  prepareStatus: string | null;
  prepareError: string | null;
  preparedLabel: string | null;
  sentAt: string | null;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply ?? "");
  const [suggesting, setSuggesting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [attach, setAttach] = useState(isResumeRequest);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(sentAt);
  const started = useRef(false);

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/emails/${encodeURIComponent(emailId)}/suggest`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (!res.ok || !data?.reply) setError(data?.error ?? "Couldn't write a reply — try again.");
      else setReply(data.reply);
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSuggesting(false);
    }
  }

  async function prepare() {
    setPreparing(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/emails/${encodeURIComponent(emailId)}/prepare`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!data?.ok && data?.error !== "Already being prepared.") setError(data?.error ?? "Couldn't prepare the resume.");
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setPreparing(false);
      router.refresh();
    }
  }

  // First visit: write the suggestion, and start the resume, without being asked.
  const startAutomatically = useEffectEvent(() => {
    if (started.current || sent) return;
    started.current = true;
    if (autoSuggest && !initialReply) void suggest();
    if (isResumeRequest && (prepareStatus === "pending" || prepareStatus === null)) void prepare();
  });
  useEffect(() => {
    // After mount, not during it — the requests then update state as they finish.
    const timer = setTimeout(startAutomatically, 0);
    return () => clearTimeout(timer);
  }, []);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/emails/${encodeURIComponent(emailId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, attachResume: attach }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) setError(data?.error ?? "Couldn't send the reply.");
      else {
        setSent(new Date().toISOString());
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const building = preparing || prepareStatus === "pending" || !!prepareStatus?.startsWith("building:");
  const ready = prepareStatus === "ready";

  return (
    <div className="flex flex-col gap-3">
      {sent && <Alert variant="success">Reply sent {new Date(sent).toLocaleString()}.</Alert>}

      {isResumeRequest && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
          {building ? (
            <span className="text-muted-foreground">Preparing a tailored Word resume… (1–2 minutes)</span>
          ) : ready ? (
            <>
              <span className="text-foreground">Word resume ready{preparedLabel ? ` — tailored for ${preparedLabel}` : ""}.</span>
              <a href={`/api/inbox/emails/${encodeURIComponent(emailId)}/resume`} className={buttonVariants("outline", "sm")}>
                <DownloadIcon className="size-4" />
                Download to check
              </a>
            </>
          ) : (
            <>
              <span className="text-destructive">{prepareError ?? "No resume prepared yet."}</span>
              <Button size="sm" variant="outline" onClick={prepare}>
                {prepareStatus === "failed" ? "Try again" : "Prepare resume"}
              </Button>
            </>
          )}
        </div>
      )}

      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={10}
        placeholder={suggesting ? "Writing a suggested reply…" : "Write your reply…"}
        aria-label="Reply"
        className="text-sm leading-relaxed"
      />
      {/\[[^\]]{2,80}\]/.test(reply) && (
        <p className="text-xs text-warning">Fill in the [placeholders] before sending.</p>
      )}

      {isResumeRequest && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} disabled={!ready} />
          Attach the Word resume
        </label>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={send}
          loading={sending}
          disabled={!reply.trim() || suggesting || (attach && !ready) || /\[[^\]]{2,80}\]/.test(reply)}
        >
          {sending ? "Sending…" : sent ? "Send again" : `Send to ${to}`}
        </Button>
        <Button variant="outline" onClick={suggest} loading={suggesting}>
          <SparklesIcon className="size-4" />
          {reply ? "Rewrite suggestion" : "Suggest a reply"}
        </Button>
      </div>
    </div>
  );
}
