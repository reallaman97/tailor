"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** From/To date range for the invoices page, driven via ?from=&to= query params. */
export function DateRangeControls({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const go = (nf: string, nt: string) => router.push(`/invoices?from=${nf}&to=${nt}`);

  function preset(kind: "month" | "d30" | "d90") {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    if (kind === "month") start.setUTCDate(1);
    else start.setUTCDate(start.getUTCDate() - (kind === "d30" ? 29 : 89));
    setF(ymd(start));
    setT(ymd(end));
    go(ymd(start), ymd(end));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input type="date" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} className="h-9 w-[9.5rem]" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input type="date" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} className="h-9 w-[9.5rem]" />
      </div>
      <Button size="sm" variant="secondary" onClick={() => go(f, t)} disabled={!f || !t}>
        Apply
      </Button>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Quick:</span>
        {(
          [
            { label: "This month", kind: "month" },
            { label: "Last 30 days", kind: "d30" },
            { label: "Last 90 days", kind: "d90" },
          ] as const
        ).map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => preset(p.kind)}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
