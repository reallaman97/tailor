"use client";

import { useActionState } from "react";
import { createCertificationAction, updateCertificationAction, deleteCertificationAction } from "./actions";
import type { CertificationEntry } from "@/lib/profile/certifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon, PlusIcon } from "@/components/icons";

function CertificationEntryForm({
  profileId,
  entry,
}: {
  profileId: string;
  entry?: CertificationEntry;
}) {
  const action = entry
    ? updateCertificationAction.bind(null, profileId, entry.id)
    : createCertificationAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formId = `certification-form-${entry?.id ?? "new"}`;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <form id={formId} action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Certification" htmlFor={`${formId}-name`}>
            <Input id={`${formId}-name`} name="name" required defaultValue={entry?.name} placeholder="e.g. AWS Certified Solutions Architect" />
          </FormField>
          <FormField label="Issuer" htmlFor={`${formId}-issuer`}>
            <Input id={`${formId}-issuer`} name="issuer" defaultValue={entry?.issuer ?? ""} placeholder="e.g. Amazon Web Services" />
          </FormField>
          <FormField label="Issue date" htmlFor={`${formId}-issueDate`}>
            <Input id={`${formId}-issueDate`} name="issueDate" type="month" defaultValue={entry?.issueDate ?? ""} />
          </FormField>
        </div>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      </form>

      <div className="flex items-center gap-2">
        <Button type="submit" form={formId} size="sm" loading={pending}>
          {pending ? "Saving…" : entry ? "Update" : "Add certification"}
        </Button>

        {entry && (
          <ConfirmDialog
            title="Delete this certification?"
            description={`This permanently removes "${entry.name}" from this profile.`}
            action={deleteCertificationAction.bind(null, profileId, entry.id)}
            triggerVariant="ghost"
            triggerSize="sm"
            triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            triggerContent={
              <>
                <TrashIcon className="size-4" />
                Delete
              </>
            }
          />
        )}
      </div>
    </div>
  );
}

export function CertificationsSection({
  profileId,
  entries,
}: {
  profileId: string;
  entries: CertificationEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certifications</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entries.map((entry) => (
          <CertificationEntryForm key={entry.id} profileId={profileId} entry={entry} />
        ))}

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <PlusIcon className="size-4" />
            Add another
          </p>
          <CertificationEntryForm profileId={profileId} />
        </div>
      </CardContent>
    </Card>
  );
}
