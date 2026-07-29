"use client";

import { useActionState, useEffect, useRef } from "react";
import { editUserAction, resetPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import type { AdminUserDetail } from "@/lib/admin/users";

export function EditUserForm({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const action = editUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.success && <Alert variant="success">Changes saved.</Alert>}

      <FormField label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={user.email} required autoComplete="off" />
      </FormField>

      <FormField label="Username" htmlFor="username">
        <Input id="username" name="username" defaultValue={user.username} required autoComplete="off" />
      </FormField>

      <FormField label="Role" htmlFor="role" hint={isSelf ? "You can't remove your own admin access." : undefined}>
        <Select id="role" name="role" defaultValue={user.role}>
          <option value="BIDDER">Bidder</option>
          <option value="CALLER">Caller</option>
          <option value="MANAGER">Manager</option>
          <option value="SUPERADMIN">Superadmin</option>
        </Select>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="approved"
          value="true"
          defaultChecked={user.approved}
          className="size-4 rounded border-input"
        />
        Approved (can log in)
      </label>

      <Button type="submit" loading={pending} className="self-start">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function PasswordResetForm({ userId }: { userId: string }) {
  const action = resetPasswordAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-lg flex-col gap-4">
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.success && <Alert variant="success">Password reset.</Alert>}

      <FormField label="New password" htmlFor="password" hint="At least 8 characters. The user isn't notified — share it securely.">
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </FormField>

      <Button type="submit" variant="outline" loading={pending} className="self-start">
        {pending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
