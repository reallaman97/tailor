import { db } from "@/lib/db";
import { DEFAULT_APPLICATION_RATE } from "@/lib/admin/rates";
import { BILLABLE_APPLICATION_WHERE } from "@/lib/payments/billable";
import type { InvoiceStatus } from "@/generated/prisma/client";

/**
 * Bidder payments / invoicing.
 *
 * A "billable" (completed) application is one that has a proof screenshot and is
 * NOT rejected — i.e. approvalStatus is PENDING or APPROVED. Generating an
 * invoice locks the bidder's currently-unpaid billable applications to it
 * (Resume.invoiceId), so the next invoice only bills applications logged since.
 * Amounts are snapshotted (count × rate) so a later rate change never alters an
 * already-issued invoice.
 */

// Billable = has a proof screenshot and isn't rejected (shared definition).
const BILLABLE = BILLABLE_APPLICATION_WHERE;

const MAX_TEXT = 2000; // cap free-text address / payment link
const MAX_ACTIVITY_DAYS = 92; // cap the per-day matrix width

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function dayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** A createdAt-in-range filter for the given inclusive [from, to] dates (or {} if unset). */
function dateRangeWhere(from?: Date, to?: Date) {
  if (!from || !to) return {};
  return { createdAt: { gte: startOfDayUTC(from), lt: addDaysUTC(startOfDayUTC(to), 1) } };
}

export class NoBillableApplicationsError extends Error {
  constructor() {
    super("This bidder has no unpaid completed applications to invoice.");
    this.name = "NoBillableApplicationsError";
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("Invoice not found.");
    this.name = "InvoiceNotFoundError";
  }
}

export type BidderBillingRow = {
  userId: string;
  name: string;
  email: string;
  rate: number;
  completedCount: number; // billable applications in range
  paidCount: number; // billable-in-range that belong to a PAID invoice
  unpaidCount: number; // billable-in-range not yet on any invoice
  amountOwed: number; // unpaidCount × rate
};

/**
 * Per-bidder billing for the invoicing screen, scoped to [from, to] (or all time
 * if unset): each bidder with their rate and how many completed (billable)
 * applications are paid vs. still unpaid, plus the amount owed on the unpaid ones.
 */
export async function getBidderBillingSummaries(teamId: string, from?: Date, to?: Date): Promise<BidderBillingRow[]> {
  const memberships = await db.teamMembership.findMany({
    where: { teamId, role: "BIDDER" },
    select: { userId: true, applicationRate: true, user: { select: { email: true, username: true } } },
  });
  if (memberships.length === 0) return [];

  const bidderIds = memberships.map((m) => m.userId);
  const billableRange = { teamId, userId: { in: bidderIds }, ...BILLABLE, ...dateRangeWhere(from, to) };

  const [completed, unpaid, paid] = await Promise.all([
    db.resume.groupBy({ by: ["userId"], where: billableRange, _count: { _all: true } }),
    db.resume.groupBy({ by: ["userId"], where: { ...billableRange, invoiceId: null }, _count: { _all: true } }),
    db.resume.groupBy({ by: ["userId"], where: { ...billableRange, invoice: { status: "PAID" } }, _count: { _all: true } }),
  ]);
  const completedBy = new Map(completed.map((g) => [g.userId, g._count._all]));
  const unpaidBy = new Map(unpaid.map((g) => [g.userId, g._count._all]));
  const paidBy = new Map(paid.map((g) => [g.userId, g._count._all]));

  return memberships
    .map((m) => {
      const rate = m.applicationRate ?? DEFAULT_APPLICATION_RATE;
      const unpaidCount = unpaidBy.get(m.userId) ?? 0;
      return {
        userId: m.userId,
        name: m.user.username ?? m.user.email,
        email: m.user.email,
        rate,
        completedCount: completedBy.get(m.userId) ?? 0,
        paidCount: paidBy.get(m.userId) ?? 0,
        unpaidCount,
        amountOwed: unpaidCount * rate,
      };
    })
    .sort((a, b) => b.amountOwed - a.amountOwed || a.name.localeCompare(b.name));
}

// ── Per-person, per-day bidding activity (with screenshot vs without) ──

export type BiddingActivity = {
  days: { key: string; label: string }[];
  rows: {
    userId: string;
    name: string;
    email: string;
    perDay: { withScreenshot: number; withoutScreenshot: number }[]; // aligned to days
    totalWith: number;
    totalWithout: number;
  }[];
  totalsPerDay: { withScreenshot: number; withoutScreenshot: number }[];
};

/**
 * How many applications each person logged per day over [from, to], split into
 * those WITH a proof screenshot and those without. The matrix is capped to the
 * most recent {@link MAX_ACTIVITY_DAYS} days.
 */
export async function getBiddingActivity(teamId: string, from: Date, to: Date): Promise<BiddingActivity> {
  const start = startOfDayUTC(from);
  const endExclusive = addDaysUTC(startOfDayUTC(to), 1);

  const allKeys: string[] = [];
  for (let d = new Date(start); d < endExclusive; d = addDaysUTC(d, 1)) allKeys.push(ymd(d));
  const keys = allKeys.slice(-MAX_ACTIVITY_DAYS);
  const days = keys.map((k) => ({ key: k, label: dayLabel(k) }));
  const dayIndex = new Map(keys.map((k, i) => [k, i]));
  const effectiveStart = keys.length ? new Date(`${keys[0]}T00:00:00.000Z`) : start;

  const resumes = await db.resume.findMany({
    where: { teamId, createdAt: { gte: effectiveStart, lt: endExclusive } },
    select: {
      userId: true,
      createdAt: true,
      screenshotMimeType: true,
      user: { select: { username: true, email: true } },
    },
  });

  type Bucket = { name: string; email: string; perDay: { withScreenshot: number; withoutScreenshot: number }[] };
  const byUser = new Map<string, Bucket>();
  const totalsPerDay = keys.map(() => ({ withScreenshot: 0, withoutScreenshot: 0 }));

  for (const r of resumes) {
    const idx = dayIndex.get(ymd(startOfDayUTC(r.createdAt)));
    if (idx === undefined) continue;
    let b = byUser.get(r.userId);
    if (!b) {
      b = {
        name: r.user?.username ?? r.user?.email ?? "Unknown",
        email: r.user?.email ?? "",
        perDay: keys.map(() => ({ withScreenshot: 0, withoutScreenshot: 0 })),
      };
      byUser.set(r.userId, b);
    }
    const has = r.screenshotMimeType != null;
    if (has) {
      b.perDay[idx].withScreenshot++;
      totalsPerDay[idx].withScreenshot++;
    } else {
      b.perDay[idx].withoutScreenshot++;
      totalsPerDay[idx].withoutScreenshot++;
    }
  }

  const rows = [...byUser.entries()]
    .map(([userId, b]) => ({
      userId,
      name: b.name,
      email: b.email,
      perDay: b.perDay,
      totalWith: b.perDay.reduce((s, d) => s + d.withScreenshot, 0),
      totalWithout: b.perDay.reduce((s, d) => s + d.withoutScreenshot, 0),
    }))
    .sort((a, b) => b.totalWith + b.totalWithout - (a.totalWith + a.totalWithout) || a.name.localeCompare(b.name));

  return { days, rows, totalsPerDay };
}

export type InvoiceRow = {
  id: string;
  bidderId: string;
  bidderName: string;
  bidderEmail: string;
  status: InvoiceStatus;
  applicationCount: number;
  rate: number;
  amount: number;
  paymentAddress: string | null;
  paymentLink: string | null;
  paidAt: Date | null;
  createdAt: Date;
};

function toRow(inv: {
  id: string;
  bidderId: string;
  status: InvoiceStatus;
  applicationCount: number;
  rate: number;
  amount: number;
  paymentAddress: string | null;
  paymentLink: string | null;
  paidAt: Date | null;
  createdAt: Date;
  bidder: { email: string; username: string | null };
}): InvoiceRow {
  return {
    id: inv.id,
    bidderId: inv.bidderId,
    bidderName: inv.bidder.username ?? inv.bidder.email,
    bidderEmail: inv.bidder.email,
    status: inv.status,
    applicationCount: inv.applicationCount,
    rate: inv.rate,
    amount: inv.amount,
    paymentAddress: inv.paymentAddress,
    paymentLink: inv.paymentLink,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
  };
}

const INVOICE_SELECT = {
  id: true,
  bidderId: true,
  status: true,
  applicationCount: true,
  rate: true,
  amount: true,
  paymentAddress: true,
  paymentLink: true,
  paidAt: true,
  createdAt: true,
  bidder: { select: { email: true, username: true } },
} as const;

/** All invoices in a team, newest first (for admins/managers). */
export async function listTeamInvoices(teamId: string): Promise<InvoiceRow[]> {
  const rows = await db.invoice.findMany({
    where: { teamId },
    select: INVOICE_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

/** A single bidder's own invoices, newest first. */
export async function listBidderInvoices(teamId: string, bidderId: string): Promise<InvoiceRow[]> {
  const rows = await db.invoice.findMany({
    where: { teamId, bidderId },
    select: INVOICE_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRow);
}

/**
 * Generates an invoice for a bidder's unpaid billable applications and locks them
 * to it. When a [from, to] range is given, only applications logged in that range
 * are billed. Atomic: the exact applications counted are the ones tagged.
 */
export async function generateInvoice(
  teamId: string,
  bidderId: string,
  createdById: string,
  opts?: { from?: Date; to?: Date }
): Promise<string> {
  const rate =
    (await db.teamMembership.findUnique({
      where: { userId_teamId: { userId: bidderId, teamId } },
      select: { applicationRate: true },
    }))?.applicationRate ?? DEFAULT_APPLICATION_RATE;

  return db.$transaction(async (tx) => {
    const apps = await tx.resume.findMany({
      where: { teamId, userId: bidderId, invoiceId: null, ...BILLABLE, ...dateRangeWhere(opts?.from, opts?.to) },
      select: { id: true },
    });
    if (apps.length === 0) throw new NoBillableApplicationsError();

    const invoice = await tx.invoice.create({
      data: {
        teamId,
        bidderId,
        createdById,
        status: "ISSUED",
        applicationCount: apps.length,
        rate,
        amount: apps.length * rate,
        ...(opts?.to ? { periodEnd: addDaysUTC(startOfDayUTC(opts.to), 1) } : {}),
      },
      select: { id: true },
    });

    await tx.resume.updateMany({
      where: { id: { in: apps.map((a) => a.id) } },
      data: { invoiceId: invoice.id },
    });

    return invoice.id;
  });
}

/** Bidder sets their payout address on their own still-issued invoice. */
export async function setInvoicePaymentAddress(
  invoiceId: string,
  bidderId: string,
  address: string
): Promise<void> {
  const res = await db.invoice.updateMany({
    where: { id: invoiceId, bidderId, status: "ISSUED" },
    data: { paymentAddress: address.trim().slice(0, MAX_TEXT) || null },
  });
  if (res.count === 0) throw new InvoiceNotFoundError();
}

/** Admin/manager marks an issued invoice paid, recording the payment link. */
export async function markInvoicePaid(invoiceId: string, teamId: string, paymentLink: string): Promise<void> {
  const res = await db.invoice.updateMany({
    where: { id: invoiceId, teamId, status: "ISSUED" },
    data: { status: "PAID", paymentLink: paymentLink.trim().slice(0, MAX_TEXT) || null, paidAt: new Date() },
  });
  if (res.count === 0) throw new InvoiceNotFoundError();
}

/**
 * Cancels an issued invoice and releases its applications back to unpaid, so
 * they'll be picked up by the next invoice. Paid invoices can't be cancelled.
 */
export async function cancelInvoice(invoiceId: string, teamId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({
      where: { id: invoiceId, teamId, status: "ISSUED" },
      select: { id: true },
    });
    if (!inv) throw new InvoiceNotFoundError();
    await tx.resume.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELED" } });
  });
}
