"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createResumeAction } from "./actions";

export function NewResumeForm() {
  const [state, formAction, pending] = useActionState(createResumeAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="companyName"
        placeholder="Company name"
        required
        className="rounded border px-3 py-2"
      />
      <input name="jobTitle" placeholder="Job title" required className="rounded border px-3 py-2" />
      <input name="jobLink" placeholder="Job posting URL (optional)" className="rounded border px-3 py-2" />
      <textarea
        name="jobDescription"
        placeholder="Paste the full job description"
        required
        rows={10}
        className="rounded border px-3 py-2"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <Link href="/dashboard" className="text-sm underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
