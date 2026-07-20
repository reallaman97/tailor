"use client";

import { useActionState } from "react";
import { createProfileAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function NewProfileForm() {
  const [state, formAction, pending] = useActionState(createProfileAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New profile</CardTitle>
        <CardDescription>Starts unassigned — assign it to an account from the Users page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="fullName">
              <Input id="fullName" name="fullName" required />
            </FormField>
            <FormField label="Contact email" htmlFor="contactEmail">
              <Input id="contactEmail" name="contactEmail" type="email" required />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" required />
            </FormField>
            <FormField label="LinkedIn URL" htmlFor="linkedinUrl">
              <Input id="linkedinUrl" name="linkedinUrl" placeholder="https://linkedin.com/in/…" />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input id="city" name="city" />
            </FormField>
            <FormField label="State" htmlFor="state">
              <Input id="state" name="state" />
            </FormField>
          </div>

          <FormField label="Professional summary" htmlFor="professionalSummary">
            <Textarea id="professionalSummary" name="professionalSummary" rows={4} />
          </FormField>

          {state?.error && <Alert variant="destructive">{state.error}</Alert>}

          <Button type="submit" loading={pending} className="self-start">
            {pending ? "Creating…" : "Create profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
