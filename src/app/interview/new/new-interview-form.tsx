"use client";

import { useActionState } from "react";
import { createInterviewAction } from "./actions";
import { InterviewFields, type Option } from "@/app/interview/interview-fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EMPTY_INTERVIEW_VALUES, type InterviewFormValues } from "@/app/interview/shared";

export function NewInterviewForm({
  initialValues,
  applicationId,
  fromApplication,
  stages,
  statuses,
  meetingTypes,
  callers,
  profiles,
}: {
  initialValues?: Partial<InterviewFormValues>;
  applicationId?: string;
  fromApplication: boolean;
  stages: Option[];
  statuses: Option[];
  meetingTypes: Option[];
  callers: Option[];
  profiles: Option[];
}) {
  const [state, formAction, pending] = useActionState(createInterviewAction, undefined);
  const values: InterviewFormValues = {
    ...EMPTY_INTERVIEW_VALUES,
    ...initialValues,
    ...state?.values,
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
      {fromApplication && (
        <Alert variant="default">Pre-filled from the linked application — edit anything before saving.</Alert>
      )}

      <InterviewFields
        values={values}
        stages={stages}
        statuses={statuses}
        meetingTypes={meetingTypes}
        callers={callers}
        profiles={profiles}
        showProfile
      />

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Creating…" : "Create interview"}
        </Button>
      </div>
    </form>
  );
}
