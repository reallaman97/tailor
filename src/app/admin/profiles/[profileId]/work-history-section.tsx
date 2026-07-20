"use client";

import { useActionState } from "react";
import {
  createWorkHistoryAction,
  updateWorkHistoryAction,
  deleteWorkHistoryAction,
} from "./actions";
import type { DecryptedWorkHistoryEntry } from "@/lib/profile/work-history";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon, PlusIcon } from "@/components/icons";

function WorkHistoryEntryForm({
  profileId,
  entry,
}: {
  profileId: string;
  entry?: DecryptedWorkHistoryEntry;
}) {
  const action = entry
    ? updateWorkHistoryAction.bind(null, profileId, entry.id)
    : createWorkHistoryAction.bind(null, profileId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const formId = `work-history-form-${entry?.id ?? "new"}`;

  return (
    // Not a <form> itself — the Delete button below needs its own <form>,
    // and HTML doesn't allow nested forms. The edit form below is
    // associated to its submit button via the `form` attribute instead.
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <form id={formId} action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company" htmlFor={`${formId}-company`}>
            <Input id={`${formId}-company`} name="company" required defaultValue={entry?.company} />
          </FormField>
          <FormField label="Job title" htmlFor={`${formId}-jobTitle`}>
            <Input id={`${formId}-jobTitle`} name="jobTitle" required defaultValue={entry?.jobTitle} />
          </FormField>
          <FormField label="Location" htmlFor={`${formId}-location`}>
            <Input id={`${formId}-location`} name="location" defaultValue={entry?.location ?? ""} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start date" htmlFor={`${formId}-startDate`}>
              <Input
                id={`${formId}-startDate`}
                name="startDate"
                type="month"
                required
                defaultValue={entry?.startDate}
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

        <FormField label="Achievements" htmlFor={`${formId}-achievements`}>
          <Textarea
            id={`${formId}-achievements`}
            name="achievements"
            placeholder="One achievement per line"
            rows={4}
            defaultValue={entry?.achievements.join("\n")}
          />
        </FormField>

        {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      </form>

      <div className="flex items-center gap-2">
        <Button type="submit" form={formId} size="sm" loading={pending}>
          {pending ? "Saving…" : entry ? "Update" : "Add entry"}
        </Button>

        {entry && (
          <ConfirmDialog
            title="Delete this role?"
            description={`This permanently removes "${entry.jobTitle}" at ${entry.company} from this profile.`}
            action={deleteWorkHistoryAction.bind(null, profileId, entry.id)}
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

export function WorkHistorySection({
  profileId,
  entries,
}: {
  profileId: string;
  entries: DecryptedWorkHistoryEntry[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work history</CardTitle>
        <CardDescription>Tailoring rewrites these bullets for a job — it never invents new ones.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entries.map((entry) => (
          <WorkHistoryEntryForm key={entry.id} profileId={profileId} entry={entry} />
        ))}

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <PlusIcon className="size-4" />
            Add another role
          </p>
          <WorkHistoryEntryForm profileId={profileId} />
        </div>
      </CardContent>
    </Card>
  );
}
