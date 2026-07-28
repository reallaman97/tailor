"use client";

import { useActionState } from "react";
import { updateInterviewAction } from "./actions";
import { InterviewFields, type Option } from "@/app/interview/interview-fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { InterviewFormValues } from "@/app/interview/shared";

export function DetailsForm({
  interviewId,
  values,
  stages,
  statuses,
  meetingTypes,
  callers,
}: {
  interviewId: string;
  values: InterviewFormValues;
  stages: Option[];
  statuses: Option[];
  meetingTypes: Option[];
  callers: Option[];
}) {
  const action = updateInterviewAction.bind(null, interviewId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {state?.success && <Alert variant="success">Interview saved.</Alert>}

      <InterviewFields
        values={values}
        stages={stages}
        statuses={statuses}
        meetingTypes={meetingTypes}
        callers={callers}
      />

      <div>
        <Button type="submit" loading={pending} className="self-start">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
