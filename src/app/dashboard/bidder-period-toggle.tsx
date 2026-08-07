"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BidderCountPeriod } from "@/lib/resumes/analytics";

const PERIODS: { value: BidderCountPeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

/** Segmented control that switches the bidder's counts view via a query param. */
export function BidderPeriodToggle({ active }: { active: BidderCountPeriod }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={`/dashboard?period=${p.value}`}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === p.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
