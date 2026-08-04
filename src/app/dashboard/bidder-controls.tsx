"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GRANULARITIES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Drives the "Applications by bidder" section via the URL: `g` (granularity),
 * `from`, `to`. Everything else on the page (e.g. `profile`) is preserved.
 * Presets compute their range on click so there's no hydration mismatch.
 */
export function BidderControls({
  granularity,
  from,
  to,
}: {
  granularity: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function navigate(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    router.push(`/dashboard?${sp.toString()}`);
  }

  // Switching granularity clears the explicit range so the sensible default
  // window for that granularity applies.
  function setGranularity(value: string) {
    navigate({ g: value, from: undefined, to: undefined });
  }

  function applyRange() {
    if (!fromValue || !toValue) return;
    navigate({ from: fromValue, to: toValue });
  }

  function preset(g: string, back: { days?: number; weeks?: number; months?: number }) {
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    if (back.days) start.setUTCDate(start.getUTCDate() - back.days);
    if (back.weeks) start.setUTCDate(start.getUTCDate() - back.weeks * 7);
    if (back.months) start.setUTCMonth(start.getUTCMonth() - back.months);
    setFromValue(ymd(start));
    setToValue(ymd(end));
    navigate({ g, from: ymd(start), to: ymd(end) });
  }

  const presets: Array<{ label: string; g: string; back: { days?: number; weeks?: number; months?: number } }> = [
    { label: "Last 7 days", g: "day", back: { days: 6 } },
    { label: "Last 30 days", g: "day", back: { days: 29 } },
    { label: "Last 8 weeks", g: "week", back: { weeks: 7 } },
    { label: "Last 6 months", g: "month", back: { months: 5 } },
    { label: "Last 12 months", g: "month", back: { months: 11 } },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Granularity segmented control */}
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
          {GRANULARITIES.map((option) => {
            const active = option.value === granularity;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setGranularity(option.value)}
                aria-pressed={active}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Explicit date range */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromValue}
            max={toValue || undefined}
            onChange={(e) => setFromValue(e.target.value)}
            className="h-9 w-[9.5rem]"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={toValue}
            min={fromValue || undefined}
            onChange={(e) => setToValue(e.target.value)}
            className="h-9 w-[9.5rem]"
            aria-label="To date"
          />
          <Button size="sm" variant="secondary" onClick={applyRange} disabled={!fromValue || !toValue}>
            Apply
          </Button>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Quick ranges:</span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => preset(p.g, p.back)}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
