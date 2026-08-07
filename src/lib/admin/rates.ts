import { db } from "@/lib/db";
import { currentWeekStartUTC } from "@/lib/resumes/analytics";

/**
 * Per-bidder application rates (USD earned per APPROVED application), stored on
 * the bidder's TeamMembership and edited by team admins/managers on the Rates
 * page. The bidder dashboard reads the same rate to show earnings.
 */

export const DEFAULT_APPLICATION_RATE = 0.08;
const MAX_APPLICATION_RATE = 10_000; // sanity ceiling on the input

export class InvalidRateError extends Error {
  constructor(message = "Enter a rate between $0 and $10,000.") {
    super(message);
    this.name = "InvalidRateError";
  }
}

/** The bidder's rate in the given team, defaulting to {@link DEFAULT_APPLICATION_RATE}. */
export async function getApplicationRate(userId: string, teamId?: string): Promise<number> {
  if (!teamId) return DEFAULT_APPLICATION_RATE;
  const membership = await db.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { applicationRate: true },
  });
  return membership?.applicationRate ?? DEFAULT_APPLICATION_RATE;
}

export type BidderRateRow = {
  userId: string;
  email: string;
  name: string;
  rate: number;
  approvedCount: number;
  approvedThisWeek: number;
  weeklyEarning: number;
  totalEarning: number;
};

/**
 * Every bidder in a team with their rate and approval-based earnings context,
 * for the Rates management page. Sorted by name.
 */
export async function listBidderRates(teamId: string): Promise<BidderRateRow[]> {
  const memberships = await db.teamMembership.findMany({
    where: { teamId, role: "BIDDER" },
    select: {
      userId: true,
      applicationRate: true,
      user: { select: { email: true, username: true } },
    },
  });
  if (memberships.length === 0) return [];

  const bidderIds = memberships.map((m) => m.userId);
  const weekStart = currentWeekStartUTC();

  const [approvedTotals, approvedWeek] = await Promise.all([
    db.resume.groupBy({
      by: ["userId"],
      where: { teamId, approvalStatus: "APPROVED", userId: { in: bidderIds } },
      _count: { _all: true },
    }),
    db.resume.groupBy({
      by: ["userId"],
      where: {
        teamId,
        approvalStatus: "APPROVED",
        userId: { in: bidderIds },
        approvedAt: { gte: weekStart },
      },
      _count: { _all: true },
    }),
  ]);

  const totalByUser = new Map(approvedTotals.map((r) => [r.userId, r._count._all]));
  const weekByUser = new Map(approvedWeek.map((r) => [r.userId, r._count._all]));

  return memberships
    .map((m) => {
      const rate = m.applicationRate ?? DEFAULT_APPLICATION_RATE;
      const approvedCount = totalByUser.get(m.userId) ?? 0;
      const approvedThisWeek = weekByUser.get(m.userId) ?? 0;
      return {
        userId: m.userId,
        email: m.user.email,
        name: m.user.username ?? m.user.email,
        rate,
        approvedCount,
        approvedThisWeek,
        weeklyEarning: approvedThisWeek * rate,
        totalEarning: approvedCount * rate,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ===========================================================================
// Weekly earnings breakdown for a team — every bidder's earning per week.
// ===========================================================================

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export type WeeklyEarningsWeek = { key: string; label: string };

export type WeeklyEarningsRow = {
  userId: string;
  name: string;
  email: string;
  rate: number;
  perWeekApproved: number[]; // aligned to weeks
  perWeekEarning: number[]; // aligned to weeks
  totalApproved: number; // all-time
  totalEarning: number; // all-time
};

export type TeamWeeklyEarnings = {
  weeks: WeeklyEarningsWeek[];
  rows: WeeklyEarningsRow[];
  perWeekTotals: number[]; // team earning totals per week
  perWeekApprovedTotals: number[]; // team approved counts per week
  grandTotalEarning: number;
};

/**
 * Every bidder's approved-application earnings per week over the last
 * `weekCount` weeks (Monday-based), plus their all-time total. Powers the
 * weekly-earnings table on the Rates panel so admins/managers can check what
 * each bidder earned week by week.
 */
export async function getTeamWeeklyEarnings(teamId: string, weekCount = 8): Promise<TeamWeeklyEarnings> {
  const currentWeekStart = currentWeekStartUTC();
  const weekStarts = Array.from({ length: weekCount }, (_, i) =>
    addDaysUTC(currentWeekStart, -(weekCount - 1 - i) * 7)
  );
  const weeks: WeeklyEarningsWeek[] = weekStarts.map((ws) => ({
    key: ymd(ws),
    label: `${MONTHS[ws.getUTCMonth()]} ${ws.getUTCDate()}`,
  }));
  const weekIndex = new Map(weeks.map((w, i) => [w.key, i]));
  const earliest = weekStarts[0];

  const memberships = await db.teamMembership.findMany({
    where: { teamId, role: "BIDDER" },
    select: { userId: true, applicationRate: true, user: { select: { email: true, username: true } } },
  });

  const emptyWeekTotals = () => new Array(weekCount).fill(0) as number[];
  if (memberships.length === 0) {
    return {
      weeks,
      rows: [],
      perWeekTotals: emptyWeekTotals(),
      perWeekApprovedTotals: emptyWeekTotals(),
      grandTotalEarning: 0,
    };
  }

  const bidderIds = memberships.map((m) => m.userId);

  const [windowApproved, allApproved] = await Promise.all([
    db.resume.findMany({
      where: { teamId, approvalStatus: "APPROVED", userId: { in: bidderIds }, approvedAt: { gte: earliest } },
      select: { userId: true, approvedAt: true },
    }),
    db.resume.groupBy({
      by: ["userId"],
      where: { teamId, approvalStatus: "APPROVED", userId: { in: bidderIds } },
      _count: { _all: true },
    }),
  ]);

  const totalApprovedByUser = new Map(allApproved.map((r) => [r.userId, r._count._all]));

  const perWeekByUser = new Map<string, number[]>();
  for (const id of bidderIds) perWeekByUser.set(id, emptyWeekTotals());
  for (const r of windowApproved) {
    if (!r.approvedAt) continue;
    // currentWeekStartUTC(date) returns THAT date's Monday, so it buckets by week.
    const idx = weekIndex.get(ymd(currentWeekStartUTC(r.approvedAt)));
    if (idx === undefined) continue;
    perWeekByUser.get(r.userId)![idx]++;
  }

  const rows: WeeklyEarningsRow[] = memberships
    .map((m) => {
      const rate = m.applicationRate ?? DEFAULT_APPLICATION_RATE;
      const perWeekApproved = perWeekByUser.get(m.userId) ?? emptyWeekTotals();
      const perWeekEarning = perWeekApproved.map((c) => c * rate);
      const totalApproved = totalApprovedByUser.get(m.userId) ?? 0;
      return {
        userId: m.userId,
        name: m.user.username ?? m.user.email,
        email: m.user.email,
        rate,
        perWeekApproved,
        perWeekEarning,
        totalApproved,
        totalEarning: totalApproved * rate,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const perWeekTotals = emptyWeekTotals();
  const perWeekApprovedTotals = emptyWeekTotals();
  for (const row of rows) {
    row.perWeekEarning.forEach((e, i) => (perWeekTotals[i] += e));
    row.perWeekApproved.forEach((c, i) => (perWeekApprovedTotals[i] += c));
  }
  const grandTotalEarning = rows.reduce((s, r) => s + r.totalEarning, 0);

  return { weeks, rows, perWeekTotals, perWeekApprovedTotals, grandTotalEarning };
}

/** Sets a bidder's per-application rate in a team. Validates and clamps the input. */
export async function setBidderRate(teamId: string, userId: string, rate: number): Promise<void> {
  if (!Number.isFinite(rate) || rate < 0 || rate > MAX_APPLICATION_RATE) {
    throw new InvalidRateError();
  }
  // Round to whole cents so the stored rate matches what was typed.
  const normalized = Math.round(rate * 100) / 100;
  await db.teamMembership.update({
    where: { userId_teamId: { userId, teamId } },
    data: { applicationRate: normalized },
  });
}
