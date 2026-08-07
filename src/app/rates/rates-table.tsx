"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircleIcon, LoaderIcon, AlertCircleIcon } from "@/components/icons";
import { setBidderRateAction } from "./actions";
import type { BidderRateRow } from "@/lib/admin/rates";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/** Inline rate editor for one bidder — saves on blur / Enter when the value changed. */
function RateInput({ userId, initialRate }: { userId: string; initialRate: number }) {
  const [value, setValue] = useState(initialRate.toFixed(2));
  const [saved, setSaved] = useState(initialRate);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const rate = Number(value);
    if (!Number.isFinite(rate)) {
      setStatus("err");
      setError("Enter a number");
      return;
    }
    if (rate === saved) return; // unchanged since last save
    start(async () => {
      const res = await setBidderRateAction(userId, rate);
      if (res.ok) {
        setSaved(rate);
        setValue(rate.toFixed(2));
        setStatus("ok");
        setError(null);
      } else {
        setStatus("err");
        setError(res.error ?? "Failed to save");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={value}
          disabled={pending}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-8 w-24 pl-5 text-sm tabular-nums"
          aria-label="Rate per approved application"
        />
      </div>
      {pending && <LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
      {!pending && status === "ok" && <CheckCircleIcon className="size-4 text-success" />}
      {!pending && status === "err" && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircleIcon className="size-4" />
          {error}
        </span>
      )}
    </div>
  );
}

export function RatesTable({ rows }: { rows: BidderRateRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bidder</TableHead>
            <TableHead>Rate / approved</TableHead>
            <TableHead className="text-right">Approved</TableHead>
            <TableHead className="text-right">This week</TableHead>
            <TableHead className="text-right">This week earned</TableHead>
            <TableHead className="text-right">All-time earned</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </TableCell>
              <TableCell>
                <RateInput userId={r.userId} initialRate={r.rate} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.approvedCount}</TableCell>
              <TableCell className="text-right tabular-nums">{r.approvedThisWeek}</TableCell>
              <TableCell className="text-right tabular-nums">{usd(r.weeklyEarning)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {usd(r.totalEarning)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
