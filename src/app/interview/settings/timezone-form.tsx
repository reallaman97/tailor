"use client";

import { useActionState } from "react";
import { updateTimezoneAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function TimezoneForm({ current, zones }: { current: string; zones: string[] }) {
  const [state, formAction, pending] = useActionState(updateTimezoneAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timezone</CardTitle>
        <CardDescription>Every interview time across the tool is displayed in this timezone.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && <Alert variant="destructive">{state.error}</Alert>}
          {state?.success && <Alert variant="success">Timezone saved.</Alert>}

          <FormField label="Display timezone" htmlFor="interviewTimezone">
            <Select id="interviewTimezone" name="interviewTimezone" defaultValue={current} className="max-w-xs">
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </FormField>

          <Button type="submit" loading={pending} className="self-start">
            {pending ? "Saving…" : "Save timezone"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
