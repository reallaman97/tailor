"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { CUSTOM_FIELD_DEFS, SECTION_LABELS } from "@/lib/interview/fields";
import type { InterviewFormValues } from "@/app/interview/shared";

export type Option = { id: string; label: string };

/**
 * The shared field set for creating/editing an interview. Uncontrolled inputs
 * (defaultValue) whose `name`s match the zod schema keys. The "Additional
 * details" section renders generically from CUSTOM_FIELD_DEFS, so a future
 * custom field appears here with no change to this component.
 */
export function InterviewFields({
  values,
  stages,
  statuses,
  meetingTypes,
  callers,
  disabled,
}: {
  values: InterviewFormValues;
  stages: Option[];
  statuses: Option[];
  meetingTypes: Option[];
  callers: Option[];
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Section title={SECTION_LABELS.job}>
        <FormField label="Job Title" htmlFor="jobTitle">
          <Input id="jobTitle" name="jobTitle" defaultValue={values.jobTitle} required disabled={disabled} />
        </FormField>
        <FormField label="Company" htmlFor="companyName">
          <Input id="companyName" name="companyName" defaultValue={values.companyName} required disabled={disabled} />
        </FormField>
        <FormField label="Job Post Link" htmlFor="jobPostLink" hint="Optional — full URL.">
          <Input id="jobPostLink" name="jobPostLink" type="url" defaultValue={values.jobPostLink} disabled={disabled} placeholder="https://…" />
        </FormField>
        <FormField label="Salary Range" htmlFor="salaryRange">
          <Input id="salaryRange" name="salaryRange" defaultValue={values.salaryRange} disabled={disabled} placeholder="e.g. $120k–$150k" />
        </FormField>
        <FormField label="Job Description" htmlFor="jobDescription" className="sm:col-span-2">
          <Textarea id="jobDescription" name="jobDescription" defaultValue={values.jobDescription} rows={6} disabled={disabled} />
        </FormField>
      </Section>

      <Section title={SECTION_LABELS.schedule}>
        <FormField label="Time" htmlFor="scheduledAt" hint="Shown in the platform timezone (set in Settings).">
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={values.scheduledAt} disabled={disabled} />
        </FormField>
        <FormField label="Interview Process" htmlFor="stageId">
          <OptionSelect id="stageId" name="stageId" value={values.stageId} options={stages} placeholder="No stage" disabled={disabled} />
        </FormField>
        <FormField label="Status" htmlFor="statusId">
          <OptionSelect id="statusId" name="statusId" value={values.statusId} options={statuses} placeholder="No status" disabled={disabled} />
        </FormField>
        <FormField label="Meeting Type" htmlFor="meetingTypeId">
          <OptionSelect id="meetingTypeId" name="meetingTypeId" value={values.meetingTypeId} options={meetingTypes} placeholder="No meeting type" disabled={disabled} />
        </FormField>
        <FormField label="Meeting Link" htmlFor="meetingLink">
          <Input id="meetingLink" name="meetingLink" type="url" defaultValue={values.meetingLink} disabled={disabled} placeholder="https://…" />
        </FormField>
      </Section>

      <Section title={SECTION_LABELS.people}>
        <FormField label="Caller" htmlFor="callerId" hint="The assigned caller account.">
          <OptionSelect id="callerId" name="callerId" value={values.callerId} options={callers} placeholder="Unassigned" disabled={disabled} />
        </FormField>
        <FormField label="Interviewer Info" htmlFor="interviewerInfo" hint="Free text — you can paste links." className="sm:col-span-2">
          <Textarea id="interviewerInfo" name="interviewerInfo" defaultValue={values.interviewerInfo} rows={4} disabled={disabled} />
        </FormField>
      </Section>

      {CUSTOM_FIELD_DEFS.length > 0 && (
        <Section title={SECTION_LABELS.custom}>
          {CUSTOM_FIELD_DEFS.map((def) => (
            <FormField key={def.key} label={def.label} htmlFor={`meta.${def.key}`} hint={def.help}>
              {def.type === "longtext" ? (
                <Textarea id={`meta.${def.key}`} name={`meta.${def.key}`} defaultValue={values.meta[def.key] ?? ""} rows={3} disabled={disabled} />
              ) : (
                <Input
                  id={`meta.${def.key}`}
                  name={`meta.${def.key}`}
                  type={def.type === "number" ? "number" : def.type === "url" ? "url" : "text"}
                  defaultValue={values.meta[def.key] ?? ""}
                  disabled={disabled}
                />
              )}
            </FormField>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function OptionSelect({
  id,
  name,
  value,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  value: string;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <Select id={id} name={name} defaultValue={value} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
