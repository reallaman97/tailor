"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon, ExternalLinkIcon } from "@/components/icons";
import type { BidderBillingRow, InvoiceRow } from "@/lib/payments/invoices";
import { generateInvoiceAction, markInvoicePaidAction, cancelInvoiceAction } from "./actions";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StatusBadge({ status }: { status: InvoiceRow["status"] }) {
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "CANCELED") return <Badge variant="secondary">Canceled</Badge>;
  return <Badge variant="warning">Issued</Badge>;
}

export function InvoicesAdminView({
  summaries,
  invoices,
  teamName,
}: {
  summaries: BidderBillingRow[];
  invoices: InvoiceRow[];
  teamName: string | null;
}) {
  const totalOwed = summaries.reduce((s, r) => s + r.amountOwed, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Amounts owed</CardTitle>
          <CardDescription>
            Unpaid completed applications (with a proof screenshot, not rejected) per bidder{teamName ? ` in ${teamName}` : ""}
            . Generating an invoice bills these and the next one starts from what's logged after. Total unbilled: {usd(totalOwed)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {summaries.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={UsersIcon} title="No bidders yet" description="Bidders in this team will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-3 font-medium text-muted-foreground">Bidder</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Rate</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Unpaid completed</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Amount owed</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((b) => (
                    <BillingRow key={b.userId} bidder={b} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>{invoices.length} invoice{invoices.length === 1 ? "" : "s"}. Mark an invoice paid once you&apos;ve sent payment to the bidder&apos;s address.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No invoices generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-3 font-medium text-muted-foreground">Bidder</th>
                    <th className="p-3 font-medium text-muted-foreground">Date</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Apps</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="p-3 font-medium text-muted-foreground">Status</th>
                    <th className="p-3 font-medium text-muted-foreground">Payment address</th>
                    <th className="p-3 font-medium text-muted-foreground">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <InvoiceAdminRow key={inv.id} invoice={inv} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BillingRow({ bidder }: { bidder: BidderBillingRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <div className="font-medium text-foreground">{bidder.name}</div>
        <div className="text-xs text-muted-foreground">{bidder.email}</div>
        {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
      </td>
      <td className="p-3 text-right tabular-nums">{usd(bidder.rate)}</td>
      <td className="p-3 text-right tabular-nums">{bidder.unpaidCount}</td>
      <td className="p-3 text-right font-medium tabular-nums text-foreground">{usd(bidder.amountOwed)}</td>
      <td className="p-3 text-right">
        <Button
          size="sm"
          loading={pending}
          disabled={bidder.unpaidCount === 0}
          onClick={() =>
            start(async () => {
              const res = await generateInvoiceAction(bidder.userId);
              setError(res.ok ? null : res.error ?? "Failed");
            })
          }
        >
          Generate invoice
        </Button>
      </td>
    </tr>
  );
}

function InvoiceAdminRow({ invoice }: { invoice: InvoiceRow }) {
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const issued = invoice.status === "ISSUED";

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="p-3">
        <div className="font-medium text-foreground">{invoice.bidderName}</div>
        <div className="text-xs text-muted-foreground">{invoice.bidderEmail}</div>
      </td>
      <td className="p-3 whitespace-nowrap text-muted-foreground">{invoice.createdAt.toISOString().slice(0, 10)}</td>
      <td className="p-3 text-right tabular-nums">{invoice.applicationCount}</td>
      <td className="p-3 text-right font-medium tabular-nums text-foreground">{usd(invoice.amount)}</td>
      <td className="p-3">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="p-3 max-w-[16rem]">
        {invoice.paymentAddress ? (
          <span className="break-all text-xs text-foreground">{invoice.paymentAddress}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{issued ? "Awaiting bidder…" : "—"}</span>
        )}
      </td>
      <td className="p-3">
        {invoice.status === "PAID" ? (
          invoice.paymentLink ? (
            <a
              href={invoice.paymentLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon className="size-3.5" /> Payment link
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Paid</span>
          )
        ) : invoice.status === "CANCELED" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Payment link / tx ref"
                className="h-8 w-48 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await markInvoicePaidAction(invoice.id, link);
                    setError(res.ok ? null : res.error ?? "Failed");
                  })
                }
              >
                Mark paid
              </Button>
              <ConfirmDialog
                title="Cancel this invoice?"
                description="Its applications are released back to unpaid and will be picked up by the next invoice. This can't be undone."
                confirmLabel="Cancel invoice"
                triggerVariant="ghost"
                triggerSize="sm"
                triggerLabel="Cancel invoice"
                triggerContent={<span className="text-xs text-destructive">Cancel</span>}
                action={async () => {
                  await cancelInvoiceAction(invoice.id);
                }}
              />
            </div>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
