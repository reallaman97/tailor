"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction } from "./actions";
import { AuthCard } from "../auth-card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signupAction, undefined);

  if (state?.pending) {
    return (
      <AuthCard
        title="Account created"
        description="One more step before you can log in."
        footer={
          <Link href="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        }
      >
        <Alert variant="success">
          Your account has been created and is pending approval. A superadmin needs to approve it
          before you can log in — check back soon.
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Build your profile once, tailor resumes for every job."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="you@example.com" required autoFocus />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" required minLength={8} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirmPassword">
          <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
        </FormField>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}

        <Button type="submit" loading={pending} className="w-full">
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </AuthCard>
  );
}
