"use server";

import { revalidatePath } from "next/cache";
import { requireInvoiceManager, requireTeamContext } from "@/lib/auth/team-context";
import {
  generateInvoice,
  markInvoicePaid,
  cancelInvoice,
  setInvoicePaymentAddress,
  NoBillableApplicationsError,
  InvoiceNotFoundError,
} from "@/lib/payments/invoices";

export type InvoiceActionResult = { ok: boolean; error?: string };

/** Team admin / manager: generate an invoice for a bidder's unpaid billable apps. */
export async function generateInvoiceAction(bidderId: string): Promise<InvoiceActionResult> {
  const ctx = await requireInvoiceManager();
  try {
    await generateInvoice(ctx.activeTeamId!, bidderId, ctx.userId);
  } catch (err) {
    if (err instanceof NoBillableApplicationsError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/invoices");
  return { ok: true };
}

/** Team admin / manager: mark an issued invoice paid, recording the payment link. */
export async function markInvoicePaidAction(invoiceId: string, paymentLink: string): Promise<InvoiceActionResult> {
  const ctx = await requireInvoiceManager();
  if (!paymentLink.trim()) return { ok: false, error: "Enter the payment link/reference." };
  try {
    await markInvoicePaid(invoiceId, ctx.activeTeamId!, paymentLink);
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return { ok: false, error: "Invoice not found or already paid." };
    throw err;
  }
  revalidatePath("/invoices");
  return { ok: true };
}

/** Team admin / manager: cancel an issued invoice (releases its applications). */
export async function cancelInvoiceAction(invoiceId: string): Promise<InvoiceActionResult> {
  const ctx = await requireInvoiceManager();
  try {
    await cancelInvoice(invoiceId, ctx.activeTeamId!);
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return { ok: false, error: "Invoice not found or already paid." };
    throw err;
  }
  revalidatePath("/invoices");
  return { ok: true };
}

/** Bidder: set the payout address on their own issued invoice. */
export async function setPaymentAddressAction(invoiceId: string, address: string): Promise<InvoiceActionResult> {
  const ctx = await requireTeamContext();
  if (!address.trim()) return { ok: false, error: "Enter a payment address." };
  try {
    await setInvoicePaymentAddress(invoiceId, ctx.userId, address);
  } catch (err) {
    if (err instanceof InvoiceNotFoundError) return { ok: false, error: "Invoice not found or already paid." };
    throw err;
  }
  revalidatePath("/invoices");
  return { ok: true };
}
