"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "./actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CheckCircleIcon } from "@/components/icons";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircleIcon className="size-5" />
        </div>
        <p className="text-sm text-foreground">Your password has been reset.</p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormField label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" required minLength={8} autoFocus />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </FormField>

      {state?.error && <Alert variant="destructive">{state.error}</Alert>}

      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
