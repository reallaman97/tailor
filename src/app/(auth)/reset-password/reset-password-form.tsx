"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-green-700">
          Your password has been reset.
        </p>
        <Link href="/login" className="underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="password"
        type="password"
        placeholder="New password"
        required
        minLength={8}
        className="rounded border px-3 py-2"
      />
      <input
        name="confirmPassword"
        type="password"
        placeholder="Confirm new password"
        required
        minLength={8}
        className="rounded border px-3 py-2"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
