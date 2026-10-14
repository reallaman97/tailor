import type { ResumeStatus } from "@/generated/prisma/client";

// Client-safe (no database imports): shared by the tracker's pages and forms.

/** Stages that mean the application is in the interview process. */
export const INTERVIEW_STAGES: ResumeStatus[] = ["REPLY", "INTRO", "TECH1", "TECH2", "FINAL"];
/** Outcomes that close it. */
export const CLOSING_STAGES: ResumeStatus[] = ["OFFER", "FAIL", "CANCELED"];
/** What the stage picker offers, in order. */
export const TRACKER_STAGES: ResumeStatus[] = [...INTERVIEW_STAGES, ...CLOSING_STAGES];
