"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon, ExternalLinkIcon } from "@/components/icons";
import type { BidderBillingRow, InvoiceRow, BiddingActivity } from "@/lib/payments/invoices";
import { DateRangeControls } from "./date-range-controls";
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
  activity,
  teamName,
  fromKey,
  toKey,
}: {
  summaries: BidderBillingRow[];
  invoices: InvoiceRow[];
  activity: BiddingActivity;
  teamName: string | null;
  fromKey: string;
  toKey: string;
}) {
  const totalOwed = summaries.reduce((s, r) => s + r.amountOwed, 0);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Date range</CardTitle>
            <CardDescription>
              All figures below cover applications logged between these dates. Generating an invoice bills the unpaid
              completed applications in this range.
            </CardDescription>
          </div>
          <DateRangeControls from={fromKey} to={toKey} />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing summary</CardTitle>
          <CardDescription>
            Completed applications (proof screenshot, not rejected){teamName ? ` in ${teamName}` : ""} for {fromKey} → {toKey}, split
            into paid and still-unpaid. Total unbilled: {usd(totalOwed)}. The amount pre-fills to the owed total — edit it before
            generating to override.
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
                    <th className="p-3 text-right font-medium text-muted-foreground">Completed</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Paid</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Unpaid</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Amount owed</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((b) => (
                    <BillingRow key={b.userId} bidder={b} fromKey={fromKey} toKey={toKey} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ActivityCard activity={activity} />

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

function BillingRow({ bidder, fromKey, toKey }: { bidder: BidderBillingRow; fromKey: string; toKey: string }) {
  const [amount, setAmount] = useState(bidder.amountOwed.toFixed(2));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = bidder.unpaidCount === 0;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <div className="font-medium text-foreground">{bidder.name}</div>
        <div className="text-xs text-muted-foreground">{bidder.email}</div>
        {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
      </td>
      <td className="p-3 text-right tabular-nums">{usd(bidder.rate)}</td>
      <td className="p-3 text-right tabular-nums">{bidder.completedCount}</td>
      <td className="p-3 text-right tabular-nums text-success">{bidder.paidCount}</td>
      <td className="p-3 text-right tabular-nums font-medium text-foreground">{bidder.unpaidCount}</td>
      <td className="p-3 text-right font-medium tabular-nums text-foreground">{usd(bidder.amountOwed)}</td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              disabled={disabled}
              onChange={(e) => setAmount(e.target.value)}
              className="h-8 w-24 pl-5 text-xs tabular-nums"
              aria-label={`Invoice amount for ${bidder.email}`}
              title="Amount to invoice (defaults to the owed total — edit to override)"
            />
          </div>
          <Button
            size="sm"
            loading={pending}
            disabled={disabled}
            onClick={() =>
              start(async () => {
                const res = await generateInvoiceAction(bidder.userId, fromKey, toKey, Number(amount));
                setError(res.ok ? null : res.error ?? "Failed");
              })
            }
          >
            Generate
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ActivityCard({ activity }: { activity: BiddingActivity }) {
  const { days, rows, totalsPerDay } = activity;
  const grandWith = rows.reduce((s, r) => s + r.totalWith, 0);
  const grandWithout = rows.reduce((s, r) => s + r.totalWithout, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bidding activity — per person, per day</CardTitle>
        <CardDescription>
          Applications logged each day. Each cell shows <span className="font-medium text-foreground">with screenshot</span> /{" "}
          <span className="text-muted-foreground">without</span>. In range: {grandWith} with screenshot, {grandWithout} without.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No applications logged in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card p-2.5 text-left font-medium text-muted-foreground">Bidder</th>
                  {days.map((d) => (
                    <th key={d.key} className="whitespace-nowrap p-2.5 text-right font-medium text-muted-foreground">
                      {d.label}
                    </th>
                  ))}
                  <th className="p-2.5 text-right font-semibold text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-t border-border">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card p-2.5 font-medium text-foreground">{r.name}</td>
                    {r.perDay.map((d, i) => (
                      <td key={days[i].key} className="p-2.5 text-right tabular-nums">
                        {d.withScreenshot === 0 && d.withoutScreenshot === 0 ? (
                          <span className="text-muted-foreground/40">·</span>
                        ) : (
                          <span>
                            <span className="text-foreground">{d.withScreenshot}</span>
                            <span className="text-muted-foreground"> / {d.withoutScreenshot}</span>
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="p-2.5 text-right font-semibold tabular-nums text-foreground">
                      {r.totalWith}
                      <span className="text-muted-foreground"> / {r.totalWithout}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <td className="sticky left-0 z-10 bg-card p-2.5 font-semibold text-foreground">Total</td>
                  {totalsPerDay.map((t, i) => (
                    <td key={days[i].key} className="p-2.5 text-right font-semibold tabular-nums text-foreground">
                      {t.withScreenshot}
                      <span className="text-muted-foreground"> / {t.withoutScreenshot}</span>
                    </td>
                  ))}
                  <td className="p-2.5 text-right font-bold tabular-nums text-primary">
                    {grandWith}
                    <span className="text-muted-foreground"> / {grandWithout}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceAdminRow({ invoice }: { invoice: InvoiceRow }) {
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          <span className="text-xs text-muted-foreground">{invoice.status === "ISSUED" ? "Awaiting bidder…" : "—"}</span>
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
