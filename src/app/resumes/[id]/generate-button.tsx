"use client";

import { useActionState } from "react";
import { generateTailoredResumeAction } from "./actions";

export function GenerateButton({ resumeId, hasContent }: { resumeId: string; hasContent: boolean }) {
  const action = generateTailoredResumeAction.bind(null, resumeId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Generating…" : hasContent ? "Regenerate" : "Generate tailored resume"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
