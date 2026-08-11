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
  unpaidCount: number; // unpaid billable applications
  amountOwed: number; // unpaidCount × rate
};

/**
 * Per-bidder "what's owed right now" for the team's invoicing screen: each
 * bidder with their rate and the count/amount of unpaid billable applications.
 */
export async function getBidderBillingSummaries(teamId: string): Promise<BidderBillingRow[]> {
  const memberships = await db.teamMembership.findMany({
    where: { teamId, role: "BIDDER" },
    select: { userId: true, applicationRate: true, user: { select: { email: true, username: true } } },
  });
  if (memberships.length === 0) return [];

  const bidderIds = memberships.map((m) => m.userId);
  const grouped = await db.resume.groupBy({
    by: ["userId"],
    where: { teamId, invoiceId: null, userId: { in: bidderIds }, ...BILLABLE },
    _count: { _all: true },
  });
  const unpaidByUser = new Map(grouped.map((g) => [g.userId, g._count._all]));

  return memberships
    .map((m) => {
      const rate = m.applicationRate ?? DEFAULT_APPLICATION_RATE;
      const unpaidCount = unpaidByUser.get(m.userId) ?? 0;
      return {
        userId: m.userId,
        name: m.user.username ?? m.user.email,
        email: m.user.email,
        rate,
        unpaidCount,
        amountOwed: unpaidCount * rate,
      };
    })
    .sort((a, b) => b.amountOwed - a.amountOwed || a.name.localeCompare(b.name));
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
 * Generates an invoice for a bidder's currently-unpaid billable applications and
 * locks them to it. Atomic: the exact applications counted are the ones tagged.
 */
export async function generateInvoice(teamId: string, bidderId: string, createdById: string): Promise<string> {
  const rate =
    (await db.teamMembership.findUnique({
      where: { userId_teamId: { userId: bidderId, teamId } },
      select: { applicationRate: true },
    }))?.applicationRate ?? DEFAULT_APPLICATION_RATE;

  return db.$transaction(async (tx) => {
    const apps = await tx.resume.findMany({
      where: { teamId, userId: bidderId, invoiceId: null, ...BILLABLE },
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
