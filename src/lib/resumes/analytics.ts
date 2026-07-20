import { db } from "@/lib/db";
import {
  POSITIVE_STATUSES,
  INTERVIEW_STATUSES,
  REJECTED_STATUSES,
  FAILED_STATUSES,
  GHOSTED_STATUSES,
  OPEN_STATUSES,
  ROLE_TRACK_OPTIONS,
  SOURCE_OPTIONS,
  getPrimaryStatus,
} from "@/lib/resume-status";
import type { RoleTrack, ApplicationSource, ResumeStatus } from "@/generated/prisma/client";

// A follow-up is suggested once an in-flight application has gone quiet for
// this many days, or its explicit follow-up date has arrived.
const FOLLOW_UP_AFTER_DAYS = 7;
const WEEKS_SHOWN = 6;

export type OverviewStats = {
  total: number;
  awaitingResponse: number;
  positiveResponses: number;
  rejected: number;
  failed: number;
  ghosted: number;
  positiveResponseRate: number; // 0-100
  needsFollowUpToday: number;
};

export type RoleTrackRow = {
  roleTrack: RoleTrack;
  applied: number;
  positive: number;
  rejected: number;
  pending: number;
  positiveRate: number; // 0-100
};

export type SourceRow = {
  source: ApplicationSource;
  applied: number;
  positive: number;
  positiveRate: number; // 0-100
};

/**
 * The trend/today views collapse everything into 3 simplified categories:
 * Positive responses (Reply/Offer), Scheduled (an interview stage reached),
 * Rejected (any of Canceled/Fail/Ghosted). The Overview panel is where the
 * detailed Rejected/Failed/Ghosted split lives.
 */
export type TrendCounts = {
  positiveResponses: number;
  scheduled: number;
  rejected: number;
};

export type WeeklyPoint = TrendCounts & { weekStart: string };

export type DashboardAnalytics = {
  overview: OverviewStats;
  byRoleTrack: RoleTrackRow[];
  bySource: SourceRow[];
  today: TrendCounts;
  weekly: WeeklyPoint[];
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d;
}

function classifyTrend(status: ResumeStatus): keyof TrendCounts | null {
  if (INTERVIEW_STATUSES.has(status)) return "scheduled";
  if (status === "REPLY" || status === "OFFER") return "positiveResponses";
  if (REJECTED_STATUSES.has(status) || FAILED_STATUSES.has(status) || GHOSTED_STATUSES.has(status)) {
    return "rejected";
  }
  return null;
}

/** Superadmin-only aggregate — rolls up every user's applications combined, not scoped to one account. */
export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const resumes = await db.resume.findMany({
    select: {
      statuses: true,
      roleTrack: true,
      source: true,
      updatedAt: true,
      followUpDate: true,
    },
  });

  const now = new Date();
  const today = dateOnly(now);

  const overview: OverviewStats = {
    total: resumes.length,
    awaitingResponse: 0,
    positiveResponses: 0,
    rejected: 0,
    failed: 0,
    ghosted: 0,
    positiveResponseRate: 0,
    needsFollowUpToday: 0,
  };

  const roleTrackTotals = new Map(ROLE_TRACK_OPTIONS.map((o) => [o.value, { applied: 0, positive: 0, rejected: 0, pending: 0 }]));
  const sourceTotals = new Map(SOURCE_OPTIONS.map((o) => [o.value, { applied: 0, positive: 0 }]));

  const currentWeekStart = startOfWeek(now);
  const weekStarts: Date[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const ws = new Date(currentWeekStart);
    ws.setUTCDate(ws.getUTCDate() - (WEEKS_SHOWN - 1 - i) * 7);
    return ws;
  });
  const weekly: WeeklyPoint[] = weekStarts.map((ws) => ({
    weekStart: dateOnly(ws),
    positiveResponses: 0,
    scheduled: 0,
    rejected: 0,
  }));
  const weekIndexByKey = new Map(weekStarts.map((ws, i) => [dateOnly(ws), i]));

  const todayTrend: TrendCounts = { positiveResponses: 0, scheduled: 0, rejected: 0 };

  for (const r of resumes) {
    // Multiple simultaneous statuses collapse to one "most final" value for
    // every classification below — see getPrimaryStatus for the precedence.
    const status = getPrimaryStatus(r.statuses);
    const isPositive = POSITIVE_STATUSES.has(status);
    const isRejected = REJECTED_STATUSES.has(status);
    const isFailed = FAILED_STATUSES.has(status);
    const isGhosted = GHOSTED_STATUSES.has(status);
    const isOpen = OPEN_STATUSES.has(status);

    if (status === "DRAFT" || status === "APPLIED") overview.awaitingResponse++;
    if (isPositive) overview.positiveResponses++;
    if (isRejected) overview.rejected++;
    if (isFailed) overview.failed++;
    if (isGhosted) overview.ghosted++;

    if (isOpen) {
      const daysSinceUpdate = Math.floor((now.getTime() - r.updatedAt.getTime()) / 86_400_000);
      const followUpDue = r.followUpDate ? dateOnly(r.followUpDate) <= today : false;
      if (daysSinceUpdate >= FOLLOW_UP_AFTER_DAYS || followUpDue) overview.needsFollowUpToday++;
    }

    const roleBucket = roleTrackTotals.get(r.roleTrack)!;
    roleBucket.applied++;
    if (isPositive) roleBucket.positive++;
    if (isRejected || isFailed) roleBucket.rejected++;
    if (isOpen) roleBucket.pending++;

    const sourceBucket = sourceTotals.get(r.source)!;
    sourceBucket.applied++;
    if (isPositive) sourceBucket.positive++;

    const trendCategory = classifyTrend(status);
    if (trendCategory) {
      if (dateOnly(r.updatedAt) === today) todayTrend[trendCategory]++;

      const weekIdx = weekIndexByKey.get(dateOnly(startOfWeek(r.updatedAt)));
      if (weekIdx !== undefined) weekly[weekIdx][trendCategory]++;
    }
  }

  overview.positiveResponseRate = overview.total > 0 ? (overview.positiveResponses / overview.total) * 100 : 0;

  const byRoleTrack: RoleTrackRow[] = ROLE_TRACK_OPTIONS.map((opt) => {
    const b = roleTrackTotals.get(opt.value)!;
    return {
      roleTrack: opt.value,
      applied: b.applied,
      positive: b.positive,
      rejected: b.rejected,
      pending: b.pending,
      positiveRate: b.applied > 0 ? (b.positive / b.applied) * 100 : 0,
    };
  });

  const bySource: SourceRow[] = SOURCE_OPTIONS.map((opt) => {
    const b = sourceTotals.get(opt.value)!;
    return {
      source: opt.value,
      applied: b.applied,
      positive: b.positive,
      positiveRate: b.applied > 0 ? (b.positive / b.applied) * 100 : 0,
    };
  });

  return { overview, byRoleTrack, bySource, today: todayTrend, weekly };
}
