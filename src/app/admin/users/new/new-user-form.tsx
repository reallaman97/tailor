"use client";

import { useActionState } from "react";
import { createUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, undefined);
  const v = state?.values;

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}

      <FormField label="Email" htmlFor="email" hint="Used to log in.">
        <Input id="email" name="email" type="email" defaultValue={v?.email} required autoComplete="off" />
      </FormField>

      <FormField label="Username" htmlFor="username" hint="Public handle (letters, numbers, underscores).">
        <Input id="username" name="username" defaultValue={v?.username} required autoComplete="off" />
      </FormField>

      <FormField label="Password" htmlFor="password" hint="At least 8 characters. The user can change it later.">
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </FormField>

      <FormField label="Role" htmlFor="role">
        <Select id="role" name="role" defaultValue={v?.role ?? "BIDDER"}>
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
          defaultChecked={v ? v.approved : true}
          className="size-4 rounded border-input"
        />
        Approved (can log in immediately)
      </label>

      <Button type="submit" loading={pending} className="self-start">
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}
