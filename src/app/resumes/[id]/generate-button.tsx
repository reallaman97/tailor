"use client";

import { useActionState } from "react";
import { generateTailoredResumeAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SparklesIcon } from "@/components/icons";

export function GenerateButton({ resumeId, hasContent }: { resumeId: string; hasContent: boolean }) {
  const action = generateTailoredResumeAction.bind(null, resumeId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" loading={pending}>
        {!pending && <SparklesIcon className="size-4" />}
        {pending ? "Generating…" : hasContent ? "Regenerate" : "Generate tailored resume"}
      </Button>
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
    </form>
  );
}
