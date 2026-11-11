import type { EmailCategory, WorkMode } from "@/generated/prisma/client";

// Client-safe (no database imports): shared by the inbox pages and processing.

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  APPLICATION_RECEIVED: "Application received",
  REJECTION: "Rejection",
  NEXT_STEP: "Next step",
  RECRUITER_OUTREACH: "Recruiter outreach",
  CONVERSATION: "Conversation",
  RESUME_REQUEST: "Resume request",
  OTHER: "Other",
};

export const CATEGORY_VARIANT: Record<EmailCategory, "success" | "destructive" | "warning" | "secondary" | "outline"> = {
  APPLICATION_RECEIVED: "secondary",
  REJECTION: "destructive",
  NEXT_STEP: "success",
  RECRUITER_OUTREACH: "warning",
  CONVERSATION: "warning",
  RESUME_REQUEST: "warning",
  OTHER: "outline",
};

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "Onsite",
  UNKNOWN: "Work mode unknown",
};

export const NEXT_STEP_LABEL: Record<string, string> = {
  interview: "Interview",
  assessment: "Assessment",
  ai_interview: "AI / video interview",
  other: "Next step",
};
