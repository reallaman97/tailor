import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart } from "@/components/line-chart";
import { BidderControls } from "./bidder-controls";
import type { BidderApplicationCounts } from "@/lib/resumes/analytics";

const GRANULARITY_NOUN: Record<BidderApplicationCounts["granularity"], string> = {
  day: "day",
  week: "week",
  month: "month",
};

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function BidderSection({ data }: { data: BidderApplicationCounts }) {
  const { granularity, periodLabels, bidders, totalsPerPeriod, grandTotal } = data;
  const noun = GRANULARITY_NOUN[granularity];
  const maxBidderTotal = Math.max(1, ...bidders.map((b) => b.total));
  const topBidder = bidders[0];

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Applications by bidder</CardTitle>
          <CardDescription>
            How many applications each bidder submitted, per {noun} — {data.fromKey} to {data.toKey}.
          </CardDescription>
        </div>
        <BidderControls granularity={granularity} from={data.fromKey} to={data.toKey} />
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Range KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Applications in range" value={String(grandTotal)} />
          <MiniStat label="Active bidders" value={String(data.activeBidders)} />
          <MiniStat
            label="Top bidder"
            value={topBidder && topBidder.total > 0 ? String(topBidder.total) : "—"}
            hint={topBidder && topBidder.total > 0 ? topBidder.bidderName : "No applications yet"}
          />
          <MiniStat
            label={`Avg / day`}
            value={data.perDayAverage.toFixed(1)}
            hint={data.busiestPeriodLabel ? `Busiest ${noun}: ${data.busiestPeriodLabel} (${data.busiestPeriodCount})` : undefined}
          />
        </div>

        {grandTotal === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No applications were submitted in this range.
          </div>
        ) : (
          <>
            {/* Trend across periods */}
            <div>
              <div className="mb-2 text-sm font-medium text-foreground">Total applications per {noun}</div>
              <LineChart
                labels={periodLabels}
                series={[{ label: "Applications", color: "var(--primary)", values: totalsPerPeriod }]}
              />
            </div>

            {/* Leaderboard */}
            <div>
              <div className="mb-3 text-sm font-medium text-foreground">Leaderboard</div>
              <div className="flex flex-col gap-2.5">
                {bidders.map((b) => (
                  <div key={b.bidderId} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 truncate text-sm text-foreground" title={b.bidderEmail || b.bidderName}>
                      {b.bidderName}
                    </div>
                    <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted/50">
                      <div
                        className="h-full rounded bg-primary/80"
                        style={{ width: `${Math.max(2, (b.total / maxBidderTotal) * 100)}%` }}
                      />
                    </div>
                    <div className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                      {b.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-period matrix */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card p-2.5 text-left font-medium text-muted-foreground">
                      Bidder
                    </th>
                    {periodLabels.map((label, i) => (
                      <th key={i} className="p-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                    <th className="p-2.5 text-right font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bidders.map((b) => (
                    <tr key={b.bidderId} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-card p-2.5 font-medium text-foreground whitespace-nowrap">
                        {b.bidderName}
                      </td>
                      {b.perPeriod.map((n, i) => (
                        <td
                          key={i}
                          className={`p-2.5 text-right tabular-nums ${n === 0 ? "text-muted-foreground/40" : "text-foreground"}`}
                        >
                          {n}
                        </td>
                      ))}
                      <td className="p-2.5 text-right font-semibold tabular-nums text-foreground">{b.total}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td className="sticky left-0 z-10 bg-card p-2.5 font-semibold text-foreground">Total</td>
                    {totalsPerPeriod.map((n, i) => (
                      <td key={i} className="p-2.5 text-right font-semibold tabular-nums text-foreground">
                        {n}
                      </td>
                    ))}
                    <td className="p-2.5 text-right font-bold tabular-nums text-primary">{grandTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
