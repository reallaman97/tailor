"use client";

import { useActionState } from "react";
import { connectMailboxAction, type ConnectState } from "./actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Connects (or reconnects) a profile's Gmail with an app password. */
export function ConnectForm({ profileId, defaultEmail }: { profileId: string; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState<ConnectState, FormData>(
    connectMailboxAction.bind(null, profileId),
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Gmail address" htmlFor={`mb-email-${profileId}`}>
          <Input id={`mb-email-${profileId}`} name="email" type="email" required defaultValue={defaultEmail} autoComplete="off" />
        </FormField>
        <FormField
          label="App password"
          htmlFor={`mb-pass-${profileId}`}
          hint="16 letters from Google Account → Security → 2-Step Verification → App passwords."
        >
          <Input id={`mb-pass-${profileId}`} name="appPassword" type="password" required autoComplete="new-password" placeholder="xxxx xxxx xxxx xxxx" />
        </FormField>
      </div>
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      <Button type="submit" loading={pending} className="self-start">
        {pending ? "Checking login…" : "Connect Gmail"}
      </Button>
    </form>
  );
}
