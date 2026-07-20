"use client";

import { useActionState } from "react";
import { createEducationAction, updateEducationAction, deleteEducationAction } from "./actions";
import type { EducationEntry } from "@/lib/profile/education";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon, PlusIcon } from "@/components/icons";

function EducationEntryForm({
  profileId,
  entry,
}: {
  profileId: string;
  entry?: EducationEntry;
}) {
  const action = entry
    ? updateEducationAction.bind(null, profileId, entry.id)
    : createEducationAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formId = `education-form-${entry?.id ?? "new"}`;

  return (
    // Not a <form> itself — the Delete button below needs its own <form>,
    // and HTML doesn't allow nested forms. The edit form below is
    // associated to its submit button via the `form` attribute instead.
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <form id={formId} action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Institution" htmlFor={`${formId}-institution`}>
            <Input id={`${formId}-institution`} name="institution" required defaultValue={entry?.institution} />
          </FormField>
          <FormField label="Degree" htmlFor={`${formId}-degree`}>
            <Input id={`${formId}-degree`} name="degree" required defaultValue={entry?.degree} />
          </FormField>
          <FormField label="Field of study" htmlFor={`${formId}-field`}>
            <Input id={`${formId}-field`} name="field" defaultValue={entry?.field ?? ""} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start date" htmlFor={`${formId}-startDate`}>
              <Input
                id={`${formId}-startDate`}
                name="startDate"
                type="month"
                defaultValue={entry?.startDate ?? ""}
              />
            </FormField>
            <FormField label="End date" htmlFor={`${formId}-endDate`}>
              <Input
                id={`${formId}-endDate`}
                name="endDate"
                type="month"
                defaultValue={entry?.endDate ?? ""}
              />
            </FormField>
          </div>
        </div>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      </form>

      <div className="flex items-center gap-2">
        <Button type="submit" form={formId} size="sm" loading={pending}>
          {pending ? "Saving…" : entry ? "Update" : "Add entry"}
        </Button>

        {entry && (
          <ConfirmDialog
            title="Delete this entry?"
            description={`This permanently removes "${entry.degree}" at ${entry.institution} from this profile.`}
            action={deleteEducationAction.bind(null, profileId, entry.id)}
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

export function EducationSection({
  profileId,
  entries,
}: {
  profileId: string;
  entries: EducationEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Education</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entries.map((entry) => (
          <EducationEntryForm key={entry.id} profileId={profileId} entry={entry} />
        ))}

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <PlusIcon className="size-4" />
            Add another
          </p>
          <EducationEntryForm profileId={profileId} />
        </div>
      </CardContent>
    </Card>
  );
}
