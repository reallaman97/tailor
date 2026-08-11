import { db } from "@/lib/db";
import { getProfileNames } from "@/lib/profile/personal-info";
import { BILLABLE_APPLICATION_WHERE } from "@/lib/payments/billable";
import {
  POSITIVE_STATUSES,
  INTERVIEW_STATUSES,
  REJECTED_STATUSES,
  FAILED_STATUSES,
  OPEN_STATUSES,
  ROLE_TRACK_OPTIONS,
  SOURCE_OPTIONS,
  getPrimaryStatus,
  needsFollowUp,
} from "@/lib/resume-status";
import type { RoleTrack, ApplicationSource, ResumeStatus } from "@/generated/prisma/client";

const WEEKS_SHOWN = 6;

export type OverviewStats = {
  total: number;
  awaitingResponse: number;
  positiveResponses: number;
  rejected: number;
  failed: number;
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
 * Rejected (any of Canceled/Fail). The Overview panel is where the detailed
 * Rejected/Failed split lives.
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

/** Monday (UTC) of the week containing `now` — the earnings week boundary. */
export function currentWeekStartUTC(now: Date = new Date()): Date {
  return startOfWeek(now);
}

function classifyTrend(status: ResumeStatus): keyof TrendCounts | null {
  if (INTERVIEW_STATUSES.has(status)) return "scheduled";
  if (status === "REPLY" || status === "OFFER") return "positiveResponses";
  if (REJECTED_STATUSES.has(status) || FAILED_STATUSES.has(status)) {
    return "rejected";
  }
  return null;
}

export type DashboardAnalyticsFilter = {
  /** Scopes every section of the dashboard to one candidate profile. Omitted (or undefined) means every profile combined. */
  profileId?: string;
  /** Scopes to one team's applications (multi-tenancy). Omitted = all teams. */
  teamId?: string;
};

/**
 * Superadmin-only aggregate. With no filter, rolls up every profile's
 * applications combined; passing `profileId` scopes every section (overview,
 * today, role-track/source breakdowns, trend) to that one candidate.
 */
export async function getDashboardAnalytics(filter: DashboardAnalyticsFilter = {}): Promise<DashboardAnalytics> {
  const resumes = await db.resume.findMany({
    where: {
      ...(filter.teamId ? { teamId: filter.teamId } : {}),
      ...(filter.profileId ? { profileId: filter.profileId } : {}),
    },
    select: {
      statuses: true,
      roleTrack: true,
      source: true,
      updatedAt: true,
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
    const isOpen = OPEN_STATUSES.has(status);

    if (status === "DRAFT" || status === "APPLIED") overview.awaitingResponse++;
    if (isPositive) overview.positiveResponses++;
    if (isRejected) overview.rejected++;
    if (isFailed) overview.failed++;

    const followUp = needsFollowUp(r.statuses, r.updatedAt, now);
    if (followUp) overview.needsFollowUpToday++;

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
    if (isRejected || isFailed) profileBucket.rejected++;
    if (isOpen) profileBucket.pending++;
    if (followUp) profileBucket.needsFollowUp++;

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

// ===========================================================================
// A single bidder's own stats + earnings (for their personal dashboard).
// ===========================================================================

export type BidderSelfStats = {
  applicationCount: number; // every application this bidder logged
  completedCount: number; // billable: has a proof screenshot and isn't rejected
  repliedCount: number; // reached the Reply stage
  completedToday: number; // completed (by createdAt) today (UTC)
  completedThisWeek: number; // completed (by createdAt) in the current week
  rate: number; // USD per completed application
  todayEarning: number; // completedToday * rate
  weeklyEarning: number; // completedThisWeek * rate
  totalEarning: number; // completedCount * rate (at the current rate)
  weekStartKey: string; // YYYY-MM-DD, Monday of the current week (UTC)
};

/**
 * A bidder's personal numbers, scoped to their active team. Bidders are paid per
 * COMPLETED application — one with a proof screenshot that isn't rejected
 * (PENDING or APPROVED both count) — the same definition the invoicing system
 * bills on. Today/this-week are bucketed by when the application was logged
 * (createdAt); all-time values every completed application at the current rate.
 */
export async function getBidderSelfStats(opts: {
  userId: string;
  teamId?: string;
  rate: number;
}): Promise<BidderSelfStats> {
  const { userId, teamId, rate } = opts;
  const base = { userId, ...(teamId ? { teamId } : {}) };
  const billable = { ...base, ...BILLABLE_APPLICATION_WHERE };

  const now = new Date();
  const dayStart = startOfDayUTC(now);
  const dayEnd = addDaysUTC(dayStart, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = addDaysUTC(weekStart, 7);

  const [applicationCount, completedCount, repliedCount, completedToday, completedThisWeek] = await Promise.all([
    db.resume.count({ where: base }),
    db.resume.count({ where: billable }),
    db.resume.count({ where: { ...base, statuses: { has: "REPLY" } } }),
    db.resume.count({ where: { ...billable, createdAt: { gte: dayStart, lt: dayEnd } } }),
    db.resume.count({ where: { ...billable, createdAt: { gte: weekStart, lt: weekEnd } } }),
  ]);

  return {
    applicationCount,
    completedCount,
    repliedCount,
    completedToday,
    completedThisWeek,
    rate,
    todayEarning: completedToday * rate,
    weeklyEarning: completedThisWeek * rate,
    totalEarning: completedCount * rate,
    weekStartKey: dateOnly(weekStart),
  };
}

// ===========================================================================
// One bidder's own application counts over a period (their personal dashboard):
// daily buckets for this week / this month, monthly buckets for this year.
// ===========================================================================

export type BidderCountPeriod = "week" | "month" | "year";

export type BidderSelfCountsBucket = { key: string; label: string; count: number };

export type BidderSelfCounts = {
  period: BidderCountPeriod;
  unitNoun: "day" | "month"; // what each bucket represents
  buckets: BidderSelfCountsBucket[]; // chronological, includes empty buckets
  total: number;
  rangeLabel: string; // human label for the covered range
  busiestLabel: string | null; // bucket with the most applications
  busiestCount: number;
  perUnitAverage: number; // total / number of buckets
};

const WEEKDAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function normalizeBidderPeriod(value: string | undefined): BidderCountPeriod {
  return value === "month" || value === "year" ? value : "week";
}

/**
 * A single bidder's application counts (by `createdAt`) bucketed for their
 * dashboard: this week and this month resolve to daily buckets; this year to
 * twelve monthly buckets. Empty buckets are included so the chart/table are
 * continuous.
 */
export async function getBidderSelfCounts(opts: {
  userId: string;
  teamId?: string;
  period: BidderCountPeriod;
}): Promise<BidderSelfCounts> {
  const { userId, teamId, period } = opts;
  const now = new Date();

  // Build the bucket scaffold + range for the chosen period.
  let rangeStart: Date;
  let rangeEnd: Date; // exclusive
  let unitNoun: "day" | "month";
  const buckets: BidderSelfCountsBucket[] = [];

  if (period === "year") {
    unitNoun = "month";
    rangeStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    rangeEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    for (let m = new Date(rangeStart); m < rangeEnd; m = addMonthsUTC(m, 1)) {
      buckets.push({ key: dateOnly(m), label: MONTH_ABBR[m.getUTCMonth()], count: 0 });
    }
  } else {
    unitNoun = "day";
    if (period === "month") {
      rangeStart = startOfMonthUTC(now);
      rangeEnd = addMonthsUTC(rangeStart, 1);
      for (let d = new Date(rangeStart); d < rangeEnd; d = addDaysUTC(d, 1)) {
        buckets.push({ key: dateOnly(d), label: String(d.getUTCDate()), count: 0 });
      }
    } else {
      // week: current week, Monday..Sunday
      rangeStart = startOfWeek(now);
      rangeEnd = addDaysUTC(rangeStart, 7);
      for (let i = 0; i < 7; i++) {
        const d = addDaysUTC(rangeStart, i);
        buckets.push({ key: dateOnly(d), label: WEEKDAY_ABBR[i], count: 0 });
      }
    }
  }

  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  const rows = await db.resume.findMany({
    where: {
      userId,
      ...(teamId ? { teamId } : {}),
      ...BILLABLE_APPLICATION_WHERE, // completed applications only (with screenshot, not rejected)
      createdAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: { createdAt: true },
  });

  for (const r of rows) {
    const bucketStart = unitNoun === "month" ? startOfMonthUTC(r.createdAt) : startOfDayUTC(r.createdAt);
    const idx = indexByKey.get(dateOnly(bucketStart));
    if (idx !== undefined) buckets[idx].count++;
  }

  const total = rows.length;
  let busiestIdx = -1;
  for (let i = 0; i < buckets.length; i++) {
    if (busiestIdx < 0 || buckets[i].count > buckets[busiestIdx].count) busiestIdx = i;
  }
  const hasBusiest = busiestIdx >= 0 && buckets[busiestIdx].count > 0;

  const rangeLabel =
    period === "year"
      ? String(now.getUTCFullYear())
      : period === "month"
        ? `${MONTH_ABBR[now.getUTCMonth()]} ${now.getUTCFullYear()}`
        : `${dateOnly(rangeStart)} – ${dateOnly(addDaysUTC(rangeEnd, -1))}`;

  return {
    period,
    unitNoun,
    buckets,
    total,
    rangeLabel,
    busiestLabel: hasBusiest ? buckets[busiestIdx].label : null,
    busiestCount: hasBusiest ? buckets[busiestIdx].count : 0,
    perUnitAverage: buckets.length > 0 ? total / buckets.length : 0,
  };
}

// ===========================================================================
// Application counts per bidder, bucketed by day / week / month over a range.
// ===========================================================================

export type BidderCountsGranularity = "day" | "week" | "month";

export type BidderCountsFilter = {
  granularity: BidderCountsGranularity;
  /** Inclusive start; when omitted a sensible default window for the granularity is used. */
  from?: Date;
  /** Inclusive end; defaults to today. */
  to?: Date;
  /** Scope to one candidate profile's applications. */
  profileId?: string;
  /** Scope to one team's applications (multi-tenancy). Omitted = all teams. */
  teamId?: string;
};

export type BidderCountsRow = {
  bidderId: string;
  bidderName: string;
  bidderEmail: string;
  perPeriod: number[]; // aligned to `periods`
  total: number;
};

export type BidderApplicationCounts = {
  granularity: BidderCountsGranularity;
  fromKey: string; // inclusive first day of the (clamped) window, YYYY-MM-DD
  toKey: string; // inclusive last day of the window
  periods: string[]; // period-start keys (YYYY-MM-DD), chronological
  periodLabels: string[]; // display labels aligned to `periods`
  bidders: BidderCountsRow[]; // sorted by total desc
  totalsPerPeriod: number[]; // column totals aligned to `periods`
  grandTotal: number;
  activeBidders: number;
  perDayAverage: number;
  busiestPeriodLabel: string | null;
  busiestPeriodCount: number;
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_PERIODS = 120; // guard against pathologically wide matrices

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function addMonthsUTC(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function periodStart(date: Date, g: BidderCountsGranularity): Date {
  if (g === "day") return startOfDayUTC(date);
  if (g === "week") return startOfWeek(date);
  return startOfMonthUTC(date);
}
function nextPeriod(date: Date, g: BidderCountsGranularity): Date {
  if (g === "day") return addDaysUTC(date, 1);
  if (g === "week") return addDaysUTC(date, 7);
  return addMonthsUTC(date, 1);
}
function periodLabel(key: string, g: BidderCountsGranularity): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  const mon = MONTH_ABBR[d.getUTCMonth()];
  if (g === "month") return `${mon} ${d.getUTCFullYear()}`;
  if (g === "week") {
    // Label the whole week (Mon–Sun) so the current week reads e.g. "Aug 3–9"
    // rather than just its start ("Aug 3"), which looked like the data stopped
    // at the Monday and hid the in-progress current week.
    const end = addDaysUTC(d, 6);
    const endMon = MONTH_ABBR[end.getUTCMonth()];
    return d.getUTCMonth() === end.getUTCMonth()
      ? `${mon} ${d.getUTCDate()}–${end.getUTCDate()}`
      : `${mon} ${d.getUTCDate()} – ${endMon} ${end.getUTCDate()}`;
  }
  return `${mon} ${d.getUTCDate()}`;
}

function defaultRange(g: BidderCountsGranularity, now: Date): { from: Date; to: Date } {
  const to = startOfDayUTC(now);
  if (g === "day") return { from: addDaysUTC(to, -13), to }; // last 14 days
  if (g === "week") return { from: addDaysUTC(startOfWeek(now), -7 * 7), to }; // last 8 weeks
  return { from: addMonthsUTC(startOfMonthUTC(now), -5), to }; // last 6 months
}

/**
 * Superadmin-only. Counts applications logged (by `createdAt`) per bidder — the
 * account that submitted them ("Applied By") — bucketed by day, week, or month
 * across a date range. Columns are generated for every period in range (even
 * empty ones) so the matrix and trend line up. Wide ranges are clamped to the
 * most recent {@link MAX_PERIODS} periods.
 */
export async function getBidderApplicationCounts(filter: BidderCountsFilter): Promise<BidderApplicationCounts> {
  const g = filter.granularity;
  const now = new Date();
  const def = defaultRange(g, now);

  const fromStart = periodStart(filter.from ?? def.from, g);
  const toStart = periodStart(filter.to ?? def.to, g);
  const windowEnd = nextPeriod(toStart >= fromStart ? toStart : fromStart, g); // exclusive

  // Enumerate periods, then keep only the most recent MAX_PERIODS.
  const allStarts: Date[] = [];
  for (let d = new Date(fromStart); d < windowEnd; d = nextPeriod(d, g)) allStarts.push(new Date(d));
  const starts = allStarts.slice(-MAX_PERIODS);
  const effectiveFrom = starts[0] ?? fromStart;
  const periods = starts.map(dateOnly);
  const periodIndex = new Map(periods.map((p, i) => [p, i]));

  const resumes = await db.resume.findMany({
    where: {
      ...(filter.teamId ? { teamId: filter.teamId } : {}),
      ...(filter.profileId ? { profileId: filter.profileId } : {}),
      createdAt: { gte: effectiveFrom, lt: windowEnd },
    },
    select: {
      userId: true,
      createdAt: true,
      user: { select: { username: true, email: true } },
    },
  });

  type Bucket = { name: string; email: string; per: number[]; total: number };
  const byBidder = new Map<string, Bucket>();
  const totalsPerPeriod = new Array(periods.length).fill(0);

  for (const r of resumes) {
    const idx = periodIndex.get(dateOnly(periodStart(r.createdAt, g)));
    if (idx === undefined) continue;
    let b = byBidder.get(r.userId);
    if (!b) {
      b = {
        name: r.user?.username ?? r.user?.email ?? "Unknown",
        email: r.user?.email ?? "",
        per: new Array(periods.length).fill(0),
        total: 0,
      };
      byBidder.set(r.userId, b);
    }
    b.per[idx]++;
    b.total++;
    totalsPerPeriod[idx]++;
  }

  const bidders: BidderCountsRow[] = [...byBidder.entries()]
    .map(([bidderId, b]) => ({ bidderId, bidderName: b.name, bidderEmail: b.email, perPeriod: b.per, total: b.total }))
    .sort((a, b) => b.total - a.total || a.bidderName.localeCompare(b.bidderName));

  const periodLabels = periods.map((p) => periodLabel(p, g));
  const grandTotal = totalsPerPeriod.reduce((s, n) => s + n, 0);

  let busiestIdx = -1;
  for (let i = 0; i < totalsPerPeriod.length; i++) {
    if (busiestIdx < 0 || totalsPerPeriod[i] > totalsPerPeriod[busiestIdx]) busiestIdx = i;
  }
  const hasBusiest = busiestIdx >= 0 && totalsPerPeriod[busiestIdx] > 0;

  const spanDays = Math.max(1, Math.round((windowEnd.getTime() - effectiveFrom.getTime()) / 86_400_000));

  return {
    granularity: g,
    fromKey: dateOnly(effectiveFrom),
    toKey: dateOnly(addDaysUTC(windowEnd, -1)),
    periods,
    periodLabels,
    bidders,
    totalsPerPeriod,
    grandTotal,
    activeBidders: bidders.filter((b) => b.total > 0).length,
    perDayAverage: grandTotal / spanDays,
    busiestPeriodLabel: hasBusiest ? periodLabels[busiestIdx] : null,
    busiestPeriodCount: hasBusiest ? totalsPerPeriod[busiestIdx] : 0,
  };
}
