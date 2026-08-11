"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FileTextIcon, ExternalLinkIcon } from "@/components/icons";
import type { InvoiceRow } from "@/lib/payments/invoices";
import { setPaymentAddressAction } from "./actions";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function StatusBadge({ status }: { status: InvoiceRow["status"] }) {
  if (status === "PAID") return <Badge variant="success">Paid</Badge>;
  if (status === "CANCELED") return <Badge variant="secondary">Canceled</Badge>;
  return <Badge variant="warning">Awaiting payment</Badge>;
}

export function InvoicesBidderView({ invoices }: { invoices: InvoiceRow[] }) {
  const paidTotal = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  const pendingTotal = invoices.filter((i) => i.status === "ISSUED").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Awaiting payment</div>
          <div className="text-2xl font-bold tabular-nums text-foreground">{usd(pendingTotal)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Paid to date</div>
          <div className="text-2xl font-bold tabular-nums text-foreground">{usd(paidTotal)}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your invoices</CardTitle>
          <CardDescription>
            Add your payment address to an invoice that&apos;s awaiting payment. Once we pay you, its status changes to Paid
            with a payment link.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileTextIcon}
                title="No invoices yet"
                description="When an admin generates an invoice for your completed applications, it'll appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
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
                    <BidderInvoiceRow key={inv.id} invoice={inv} />
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

function BidderInvoiceRow({ invoice }: { invoice: InvoiceRow }) {
  const [address, setAddress] = useState(invoice.paymentAddress ?? "");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const editable = invoice.status === "ISSUED";

  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="p-3 whitespace-nowrap text-muted-foreground">{invoice.createdAt.toISOString().slice(0, 10)}</td>
      <td className="p-3 text-right tabular-nums">{invoice.applicationCount}</td>
      <td className="p-3 text-right font-medium tabular-nums text-foreground">{usd(invoice.amount)}</td>
      <td className="p-3">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="p-3 max-w-[18rem]">
        {editable ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setStatus("idle");
                }}
                placeholder="Wallet / bank / PayPal address"
                className="h-8 w-56 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const res = await setPaymentAddressAction(invoice.id, address);
                    if (res.ok) {
                      setStatus("saved");
                      setError(null);
                    } else {
                      setStatus("err");
                      setError(res.error ?? "Failed");
                    }
                  })
                }
              >
                Save
              </Button>
            </div>
            {status === "saved" && <span className="text-xs text-success">Saved.</span>}
            {status === "err" && <span className="text-xs text-destructive">{error}</span>}
          </div>
        ) : invoice.paymentAddress ? (
          <span className="break-all text-xs text-foreground">{invoice.paymentAddress}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-3">
        {invoice.status === "PAID" && invoice.paymentLink ? (
          <a
            href={invoice.paymentLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLinkIcon className="size-3.5" /> View payment
          </a>
        ) : invoice.status === "PAID" ? (
          <span className="text-xs text-muted-foreground">Paid</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
