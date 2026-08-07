import { db } from "@/lib/db";
import { currentWeekStartUTC } from "@/lib/resumes/analytics";

/**
 * Per-bidder application rates (USD earned per APPROVED application), stored on
 * the bidder's TeamMembership and edited by team admins/managers on the Rates
 * page. The bidder dashboard reads the same rate to show earnings.
 */

export const DEFAULT_APPLICATION_RATE = 0.8;
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
