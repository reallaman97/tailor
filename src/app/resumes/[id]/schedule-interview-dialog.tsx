"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { scheduleInterviewFromApplicationAction } from "./schedule-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

export type Option = { id: string; label: string };

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  company,
  jobTitle,
  stages,
  statuses,
  meetingTypes,
  callers,
  defaultStatusId,
  timezone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  company: string;
  jobTitle: string;
  stages: Option[];
  statuses: Option[];
  meetingTypes: Option[];
  callers: Option[];
  defaultStatusId: string;
  timezone: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = scheduleInterviewFromApplicationAction.bind(null, applicationId);
  const [state, formAction, pending] = useActionState(action, undefined);

  // Sync the native <dialog> with the controlled `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
      style={{ width: "calc(100vw - 2rem)", maxWidth: "36rem" }}
      className="m-auto box-border rounded-lg border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex flex-col gap-1 border-b border-border p-5">
        <h3 className="text-base font-semibold">Schedule interview</h3>
        <p className="text-sm text-muted-foreground">
          {jobTitle} · {company} — creates an interview linked to this application (job details, candidate, and resume are carried over).
        </p>
      </div>

      {state?.interviewId ? (
        <div className="flex flex-col gap-4 p-5">
          <Alert variant="success">Interview scheduled and linked to this application.</Alert>
          <div className="flex items-center gap-2">
            <Link href={`/interview/${state.interviewId}`} className={buttonVariants("primary", "sm")}>
              View interview
            </Link>
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4 p-5">
          {state?.error && <Alert variant="destructive">{state.error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Time" htmlFor="scheduledAt" hint={`Shown in ${timezone}.`}>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </FormField>
            <FormField label="Interview Process" htmlFor="stageId">
              <Select id="stageId" name="stageId" defaultValue="">
                <option value="">No stage</option>
                {stages.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="statusId">
              <Select id="statusId" name="statusId" defaultValue={defaultStatusId}>
                <option value="">No status</option>
                {statuses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Meeting Type" htmlFor="meetingTypeId">
              <Select id="meetingTypeId" name="meetingTypeId" defaultValue="">
                <option value="">No meeting type</option>
                {meetingTypes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Meeting Link" htmlFor="meetingLink" className="sm:col-span-2">
              <Input id="meetingLink" name="meetingLink" type="url" placeholder="https://…" />
            </FormField>
            <FormField label="Caller" htmlFor="callerId" hint="Assign a caller (optional).">
              <Select id="callerId" name="callerId" defaultValue="">
                <option value="">Unassigned</option>
                {callers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Interviewer" htmlFor="interviewerInfo" hint="Name(s) and any details; links are allowed." className="sm:col-span-2">
              <Textarea id="interviewerInfo" name="interviewerInfo" rows={3} placeholder="e.g. Jane Smith (Eng Manager), jane@company.com" />
            </FormField>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" loading={pending}>
              {pending ? "Scheduling…" : "Schedule interview"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
