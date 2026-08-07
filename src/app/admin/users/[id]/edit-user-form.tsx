"use client";

import { useActionState, useEffect, useRef } from "react";
import { editUserAction, resetPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { assignableRoleOptions } from "@/lib/auth/roles";
import type { AdminUserDetail } from "@/lib/admin/users";

export function EditUserForm({
  user,
  isSelf,
  isServiceAdmin,
  teams,
}: {
  user: AdminUserDetail;
  isSelf: boolean;
  isServiceAdmin: boolean;
  teams: { id: string; name: string }[];
}) {
  const action = editUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState(action, undefined);

  const roleOptions = assignableRoleOptions(isServiceAdmin);
  // Legacy SUPERADMIN accounts map to Team Admin in the new model.
  const defaultRole = user.role === "SUPERADMIN" ? "TEAM_ADMIN" : user.role;

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

      {isServiceAdmin && (
        <FormField label="Team" htmlFor="teamId" hint="Which team this user belongs to.">
          <Select id="teamId" name="teamId" defaultValue={user.teamId ?? teams[0]?.id ?? ""}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Role" htmlFor="role" hint={isSelf ? "You can't remove your own admin access." : undefined}>
        <Select id="role" name="role" defaultValue={defaultRole}>
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
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
