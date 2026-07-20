"use client";

import { useActionState } from "react";
import { savePersonalInfoAction } from "./actions";
import type { DecryptedPersonalInfo } from "@/lib/profile/personal-info";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function PersonalInfoForm({
  profileId,
  info,
}: {
  profileId: string;
  info: DecryptedPersonalInfo | null;
}) {
  const action = savePersonalInfoAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal info</CardTitle>
        <CardDescription>The contact details and summary that appear on this profile&apos;s resumes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="fullName">
              <Input id="fullName" name="fullName" required defaultValue={info?.fullName} />
            </FormField>
            <FormField label="Contact email" htmlFor="contactEmail">
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                required
                defaultValue={info?.contactEmail}
              />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" required defaultValue={info?.phone} />
            </FormField>
            <FormField label="LinkedIn URL" htmlFor="linkedinUrl">
              <Input
                id="linkedinUrl"
                name="linkedinUrl"
                placeholder="https://linkedin.com/in/…"
                defaultValue={info?.linkedinUrl ?? ""}
              />
            </FormField>
            <FormField label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={info?.city ?? ""} />
            </FormField>
            <FormField label="State" htmlFor="state">
              <Input id="state" name="state" defaultValue={info?.state ?? ""} />
            </FormField>
          </div>

          <FormField label="Professional summary" htmlFor="professionalSummary">
            <Textarea
              id="professionalSummary"
              name="professionalSummary"
              rows={4}
              defaultValue={info?.professionalSummary ?? ""}
            />
          </FormField>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reference only — never included on generated resumes
            </legend>
            <FormField label="Date of birth" htmlFor="dateOfBirth">
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                className="max-w-xs"
                defaultValue={info?.dateOfBirth ?? ""}
              />
            </FormField>
            <FormField label="Address line 1" htmlFor="addressLine1">
              <Input id="addressLine1" name="addressLine1" defaultValue={info?.addressLine1 ?? ""} />
            </FormField>
            <FormField label="Address line 2" htmlFor="addressLine2">
              <Input id="addressLine2" name="addressLine2" defaultValue={info?.addressLine2 ?? ""} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Postal code" htmlFor="postalCode">
                <Input id="postalCode" name="postalCode" defaultValue={info?.postalCode ?? ""} />
              </FormField>
              <FormField label="Country" htmlFor="country">
                <Input id="country" name="country" defaultValue={info?.country ?? ""} />
              </FormField>
            </div>
          </fieldset>

          {state?.error && <Alert variant="destructive">{state.error}</Alert>}
          {state?.success && <Alert variant="success">Saved.</Alert>}

          <Button type="submit" loading={pending} className="self-start">
            {pending ? "Saving…" : "Save personal info"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
