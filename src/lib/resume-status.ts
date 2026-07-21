import type { ResumeStatus, RoleTrack, ApplicationSource, ApprovalStatus } from "@/generated/prisma/client";

export const STATUS_OPTIONS: { value: ResumeStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPLIED", label: "Applied" },
  { value: "REPLY", label: "Reply" },
  { value: "INTRO", label: "Intro" },
  { value: "TECH1", label: "Tech 1" },
  { value: "TECH2", label: "Tech 2" },
  { value: "FINAL", label: "Final" },
  { value: "OFFER", label: "Offer" },
  { value: "FAIL", label: "Fail" },
  { value: "CANCELED", label: "Canceled" },
];

export const STATUS_LABEL: Record<ResumeStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<ResumeStatus, string>;

// A unique color per status, so an abbreviated (first-letter) status pill is
// still distinguishable when several share a first letter (e.g. Tech 1 / Tech 2,
// Final / Fail). Semantic where it matters: Offer green, Fail red, Canceled
// orange; the interview stages progress teal → fuchsia.
export const STATUS_COLOR: Record<ResumeStatus, string> = {
  DRAFT: "#64748b", // slate
  APPLIED: "#3b82f6", // blue
  REPLY: "#06b6d4", // cyan
  INTRO: "#14b8a6", // teal
  TECH1: "#8b5cf6", // violet
  TECH2: "#a855f7", // purple
  FINAL: "#d946ef", // fuchsia
  OFFER: "#22c55e", // green
  FAIL: "#ef4444", // red
  CANCELED: "#f97316", // orange
};

// Dashboard reporting buckets — several raw statuses roll up into one
// reporting category. Kept as Sets (not a switch) so analytics.ts can test
// membership directly.
export const POSITIVE_STATUSES = new Set<ResumeStatus>(["REPLY", "INTRO", "TECH1", "TECH2", "FINAL", "OFFER"]);
export const INTERVIEW_STATUSES = new Set<ResumeStatus>(["INTRO", "TECH1", "TECH2", "FINAL"]);
export const REJECTED_STATUSES = new Set<ResumeStatus>(["CANCELED"]);
export const FAILED_STATUSES = new Set<ResumeStatus>(["FAIL"]);
// Still "in flight" — used to compute follow-up-needed and days-open.
export const OPEN_STATUSES = new Set<ResumeStatus>(["DRAFT", "APPLIED", "REPLY", "INTRO", "TECH1", "TECH2", "FINAL"]);

// An application can hold several simultaneous statuses (e.g. Applied+Reply+
// Tech1 — a running history of stages reached, not a single current state).
// Reporting/badges-of-record need ONE representative value, so this
// precedence collapses a set down to whichever status is "most final":
// terminal outcomes always outrank in-progress stages, and among
// in-progress stages the furthest-along one wins.
const STATUS_PRECEDENCE: ResumeStatus[] = [
  "OFFER",
  "FAIL",
  "CANCELED",
  "FINAL",
  "TECH2",
  "TECH1",
  "INTRO",
  "REPLY",
  "APPLIED",
  "DRAFT",
];

export function getPrimaryStatus(statuses: ResumeStatus[]): ResumeStatus {
  for (const candidate of STATUS_PRECEDENCE) {
    if (statuses.includes(candidate)) return candidate;
  }
  return statuses[0] ?? "DRAFT";
}

export const FOLLOW_UP_AFTER_DAYS = 7;

/**
 * An application needs a follow-up when it has had a response (a stage past
 * Applied that isn't a closed-out outcome — Reply/Intro/Tech/Final/Offer) but
 * has then gone quiet — no status change — for MORE than FOLLOW_UP_AFTER_DAYS.
 */
export function needsFollowUp(statuses: ResumeStatus[], updatedAt: Date, now: Date = new Date()): boolean {
  return (
    POSITIVE_STATUSES.has(getPrimaryStatus(statuses)) &&
    now.getTime() - updatedAt.getTime() > FOLLOW_UP_AFTER_DAYS * 86_400_000
  );
}

export const ROLE_TRACK_OPTIONS: { value: RoleTrack; label: string }[] = [
  { value: "BACKEND", label: "Backend" },
  { value: "FRONTEND", label: "Frontend" },
  { value: "FULL_STACK", label: "Full Stack" },
  { value: "DEVOPS_CLOUD", label: "DevOps/Cloud" },
  { value: "DATA", label: "Data" },
  { value: "AI_ML", label: "AI/ML" },
  { value: "SUPPORT_OPS", label: "Support/Ops" },
  { value: "MOBILE", label: "Mobile" },
  { value: "OTHER", label: "Other" },
];

export const ROLE_TRACK_LABEL: Record<RoleTrack, string> = Object.fromEntries(
  ROLE_TRACK_OPTIONS.map((o) => [o.value, o.label])
) as Record<RoleTrack, string>;

export const SOURCE_OPTIONS: { value: ApplicationSource; label: string }[] = [
  { value: "JOB_BOARD", label: "Job Board" },
  { value: "LINKEDIN_OUTREACH", label: "LinkedIn Outreach" },
  { value: "RECRUITER", label: "Recruiter" },
  { value: "OTHER", label: "Other" },
];

export const SOURCE_LABEL: Record<ApplicationSource, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ApplicationSource, string>;

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const APPROVAL_BADGE_VARIANT: Record<
  ApprovalStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};
