"use client";

import { useState } from "react";
import { StatusMultiSelect } from "../status-select";
import { ScheduleInterviewDialog, type Option } from "./schedule-interview-dialog";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@/components/icons";
import type { ResumeStatus } from "@/generated/prisma/client";

/**
 * Superadmin application-tracking controls: the status multi-select plus a
 * "Schedule interview" button. Adding an interview-stage status also opens the
 * schedule dialog, which creates an interview linked to this application.
 */
export function ScheduleControls({
  resumeId,
  statuses,
  applicationId,
  company,
  jobTitle,
  stages,
  interviewStatuses,
  meetingTypes,
  callers,
  defaultStatusId,
  timezone,
}: {
  resumeId: string;
  statuses: ResumeStatus[];
  applicationId: string;
  company: string;
  jobTitle: string;
  stages: Option[];
  interviewStatuses: Option[];
  meetingTypes: Option[];
  callers: Option[];
  defaultStatusId: string;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <StatusMultiSelect resumeId={resumeId} statuses={statuses} onSchedule={() => setOpen(true)} />
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarIcon className="size-4" />
        Schedule interview
      </Button>
      <ScheduleInterviewDialog
        open={open}
        onOpenChange={setOpen}
        applicationId={applicationId}
        company={company}
        jobTitle={jobTitle}
        stages={stages}
        statuses={interviewStatuses}
        meetingTypes={meetingTypes}
        callers={callers}
        defaultStatusId={defaultStatusId}
        timezone={timezone}
      />
    </>
  );
}
