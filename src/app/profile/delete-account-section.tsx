"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "./actions";

export function DeleteAccountSection() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, undefined);

  return (
    <section className="flex flex-col gap-3 rounded border border-red-300 p-4">
      <h2 className="text-lg font-semibold text-red-700">Delete account</h2>
      <p className="text-sm text-gray-600">
        Permanently deletes your account and everything derived from it — profile, work history,
        education, skills, and all generated resumes. This cannot be undone.
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <label className="text-sm">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          name="confirmation"
          required
          className="max-w-xs rounded border px-3 py-2"
          autoComplete="off"
        />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Permanently delete my account"}
        </button>
      </form>
    </section>
  );
}
