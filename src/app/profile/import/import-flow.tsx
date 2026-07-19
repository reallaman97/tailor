"use client";

import { useActionState } from "react";
import { importResumeAction } from "./actions";
import { ImportReviewForm } from "./import-review-form";

export function ImportFlow() {
  const [state, formAction, pending] = useActionState(importResumeAction, undefined);

  if (state?.draft) {
    return <ImportReviewForm draft={state.draft} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="resume"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required
        className="rounded border px-3 py-2"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Parsing…" : "Upload and parse"}
      </button>
    </form>
  );
}
