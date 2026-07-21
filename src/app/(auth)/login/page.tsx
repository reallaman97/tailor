"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { AuthCard } from "../auth-card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <AuthCard
      title="Log in"
      description="Welcome back — sign in to your account."
      footer={
        <div className="flex justify-between">
          <Link href="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <PasswordInput id="password" name="password" required />
        </FormField>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
