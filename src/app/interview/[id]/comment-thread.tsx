"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { formatInterviewTime } from "@/lib/interview/timezone";
import type { InterviewCommentView } from "@/lib/interview/interviews";

export function CommentThread({
  interviewId,
  comments,
  timezone,
}: {
  interviewId: string;
  comments: InterviewCommentView[];
  timezone: string;
}) {
  const action = addCommentAction.bind(null, interviewId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box once a comment posts (the list refreshes via revalidation).
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border border-border bg-card/50 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{c.authorName}</span>
              <span className="text-xs text-muted-foreground">{formatInterviewTime(c.createdAt, timezone)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
          </li>
        ))}
      </ul>

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
        <Textarea name="body" rows={3} placeholder="Add a comment…" required />
        <Button type="submit" size="sm" loading={pending} className="self-start">
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </form>
    </div>
  );
}
