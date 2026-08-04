"use client";

import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveCriteriaAction } from "./actions";

type Option = { value: string; label: string };

export function CriteriaForm({
  criteria,
  workStyleOptions,
}: {
  criteria: { country: string; workStyle: string; jobCategory: string };
  workStyleOptions: Option[];
}) {
  const [state, formAction, pending] = useActionState(saveCriteriaAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Country" htmlFor="country" hint='Target country, or "ANY".'>
          <Input id="country" name="country" defaultValue={criteria.country} placeholder="US" />
        </FormField>
        <FormField label="Working style" htmlFor="workStyle">
          <Select id="workStyle" name="workStyle" defaultValue={criteria.workStyle} className="w-full">
            {workStyleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        label="Job title category"
        htmlFor="jobCategory"
        hint="Describe which roles count as valid — the checker uses this text."
      >
        <Textarea id="jobCategory" name="jobCategory" rows={3} defaultValue={criteria.jobCategory} />
      </FormField>

      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.ok && <Alert variant="success">{state.ok}</Alert>}

      <div>
        <Button type="submit" loading={pending}>
          Save criteria
        </Button>
      </div>
    </form>
  );
}
