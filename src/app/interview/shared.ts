import { CUSTOM_FIELD_DEFS } from "@/lib/interview/fields";

/**
 * Plain, serializable field values shared by the create and edit interview
 * forms. `scheduledAt` is a `datetime-local` string ("YYYY-MM-DDTHH:mm"); the
 * action converts it to/from a UTC instant using the Settings timezone.
 *
 * Lives in a non-"use server" module so both client forms and server actions
 * can import the type + helpers (a "use server" file may only export actions).
 */
export type InterviewFormValues = {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  jobPostLink: string;
  salaryRange: string;
  scheduledAt: string;
  meetingLink: string;
  interviewerInfo: string;
  stageId: string;
  statusId: string;
  meetingTypeId: string;
  callerId: string;
  profileId: string;
  meta: Record<string, string>;
};

export const EMPTY_INTERVIEW_VALUES: InterviewFormValues = {
  jobTitle: "",
  companyName: "",
  jobDescription: "",
  jobPostLink: "",
  salaryRange: "",
  scheduledAt: "",
  meetingLink: "",
  interviewerInfo: "",
  stageId: "",
  statusId: "",
  meetingTypeId: "",
  callerId: "",
  profileId: "",
  meta: {},
};

export type NewInterviewState =
  | { error?: string; values?: InterviewFormValues }
  | undefined;

export type EditInterviewState = { error?: string; success?: boolean } | undefined;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Re-reads submitted values so a form can repopulate after a validation error. */
export function readInterviewValues(formData: FormData): InterviewFormValues {
  const meta: Record<string, string> = {};
  for (const def of CUSTOM_FIELD_DEFS) {
    meta[def.key] = str(formData, `meta.${def.key}`);
  }
  return {
    jobTitle: str(formData, "jobTitle"),
    companyName: str(formData, "companyName"),
    jobDescription: str(formData, "jobDescription"),
    jobPostLink: str(formData, "jobPostLink"),
    salaryRange: str(formData, "salaryRange"),
    scheduledAt: str(formData, "scheduledAt"),
    meetingLink: str(formData, "meetingLink"),
    interviewerInfo: str(formData, "interviewerInfo"),
    stageId: str(formData, "stageId"),
    statusId: str(formData, "statusId"),
    meetingTypeId: str(formData, "meetingTypeId"),
    callerId: str(formData, "callerId"),
    profileId: str(formData, "profileId"),
    meta,
  };
}
