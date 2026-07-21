import { db } from "@/lib/db";
import { getProfileNames } from "@/lib/profile/personal-info";
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

export type ProfileRow = {
  profileId: string | null;
  profileName: string | null;
  total: number;
  awaitingResponse: number;
  positiveResponses: number;
  rejected: number;
  pending: number;
  positiveRate: number; // 0-100
  needsFollowUp: number;
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
  byProfile: ProfileRow[];
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

export type DashboardAnalyticsFilter = {
  /** Scopes every section of the dashboard to one candidate profile. Omitted (or undefined) means every profile combined. */
  profileId?: string;
};

/**
 * Superadmin-only aggregate. With no filter, rolls up every profile's
 * applications combined; passing `profileId` scopes every section (overview,
 * today, role-track/source breakdowns, trend) to that one candidate.
 */
export async function getDashboardAnalytics(filter: DashboardAnalyticsFilter = {}): Promise<DashboardAnalytics> {
  const resumes = await db.resume.findMany({
    where: filter.profileId ? { profileId: filter.profileId } : {},
    select: {
      statuses: true,
      roleTrack: true,
      source: true,
      updatedAt: true,
      followUpDate: true,
      profileId: true,
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

  type ProfileBucket = {
    total: number;
    awaitingResponse: number;
    positiveResponses: number;
    rejected: number;
    pending: number;
    needsFollowUp: number;
  };
  const profileTotals = new Map<string | null, ProfileBucket>();

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

    const needsFollowUp =
      isOpen &&
      (Math.floor((now.getTime() - r.updatedAt.getTime()) / 86_400_000) >= FOLLOW_UP_AFTER_DAYS ||
        (r.followUpDate ? dateOnly(r.followUpDate) <= today : false));
    if (needsFollowUp) overview.needsFollowUpToday++;

    if (!profileTotals.has(r.profileId)) {
      profileTotals.set(r.profileId, {
        total: 0,
        awaitingResponse: 0,
        positiveResponses: 0,
        rejected: 0,
        pending: 0,
        needsFollowUp: 0,
      });
    }
    const profileBucket = profileTotals.get(r.profileId)!;
    profileBucket.total++;
    if (status === "DRAFT" || status === "APPLIED") profileBucket.awaitingResponse++;
    if (isPositive) profileBucket.positiveResponses++;
    if (isRejected || isFailed || isGhosted) profileBucket.rejected++;
    if (isOpen) profileBucket.pending++;
    if (needsFollowUp) profileBucket.needsFollowUp++;

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

  const profileIds = [...profileTotals.keys()].filter((id): id is string => id !== null);
  const namesByProfileId = await getProfileNames(profileIds);

  const byProfile: ProfileRow[] = [...profileTotals.entries()]
    .map(([profileId, b]) => ({
      profileId,
      profileName: profileId ? (namesByProfileId.get(profileId) ?? null) : null,
      total: b.total,
      awaitingResponse: b.awaitingResponse,
      positiveResponses: b.positiveResponses,
      rejected: b.rejected,
      pending: b.pending,
      positiveRate: b.total > 0 ? (b.positiveResponses / b.total) * 100 : 0,
      needsFollowUp: b.needsFollowUp,
    }))
    // Unassigned-profile applications (profileId null) always sort last, since
    // they're a catch-all rather than a real candidate to track individually.
    .sort((a, b) => {
      if (a.profileId === null) return 1;
      if (b.profileId === null) return -1;
      return b.total - a.total || (a.profileName ?? "").localeCompare(b.profileName ?? "");
    });

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

  return { overview, byProfile, byRoleTrack, bySource, today: todayTrend, weekly };
}
