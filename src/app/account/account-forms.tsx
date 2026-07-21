"use client";

import { useActionState } from "react";
import { updateUsernameAction, changePasswordAction } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function AccountForms({ username, email }: { username: string; email: string }) {
  const [usernameState, usernameFormAction, usernamePending] = useActionState(updateUsernameAction, undefined);
  const [passwordState, passwordFormAction, passwordPending] = useActionState(changePasswordAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Username</CardTitle>
          <CardDescription>
            Your handle across the platform. You sign in with your email ({email}), which can&apos;t be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={usernameFormAction} className="flex flex-col gap-4">
            <FormField label="Username" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                title="Letters, numbers, and underscores only"
                defaultValue={username}
                className="max-w-xs"
              />
            </FormField>

            {usernameState?.error && <Alert variant="destructive">{usernameState.error}</Alert>}
            {usernameState?.success && <Alert variant="success">Username updated.</Alert>}

            <Button type="submit" loading={usernamePending} className="self-start">
              {usernamePending ? "Saving…" : "Save username"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Choose a strong password you don&apos;t use anywhere else.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* key resets the fields after a successful change */}
          <form
            key={passwordState?.success ? "done" : "editing"}
            action={passwordFormAction}
            className="flex max-w-sm flex-col gap-4"
          >
            <FormField label="Current password" htmlFor="currentPassword">
              <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
            </FormField>
            <FormField label="New password" htmlFor="newPassword">
              <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required minLength={8} />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirmNewPassword">
              <PasswordInput
                id="confirmNewPassword"
                name="confirmNewPassword"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </FormField>

            {passwordState?.error && <Alert variant="destructive">{passwordState.error}</Alert>}
            {passwordState?.success && <Alert variant="success">Password changed.</Alert>}

            <Button type="submit" loading={passwordPending} className="self-start">
              {passwordPending ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
