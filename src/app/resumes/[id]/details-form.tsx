"use client";

import { useActionState } from "react";
import { updateResumeDetailsAction } from "./actions";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SOURCE_OPTIONS } from "@/lib/resume-status";
import type { ApplicationSource } from "@/generated/prisma/client";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Superadmin-only: source, follow-up date, and notes. Role track is never manually editable — it's AI-classified at creation. */
export function DetailsForm({
  resumeId,
  source,
  followUpDate,
  notes,
}: {
  resumeId: string;
  source: ApplicationSource;
  followUpDate: Date | null;
  notes: string | null;
}) {
  const action = updateResumeDetailsAction.bind(null, resumeId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Source" htmlFor="source">
          <Select id="source" name="source" defaultValue={source}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Follow-up date" htmlFor="followUpDate">
          <Input id="followUpDate" name="followUpDate" type="date" defaultValue={toDateInputValue(followUpDate)} />
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={notes ?? ""} />
      </FormField>

      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.success && <Alert variant="success">Saved.</Alert>}

      <Button type="submit" variant="secondary" size="sm" loading={pending} className="self-start">
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
