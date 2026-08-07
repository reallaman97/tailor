import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TeamWeeklyEarnings } from "@/lib/admin/rates";

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/** Read-only matrix: each bidder's approved-application earnings, week by week. */
export function WeeklyEarningsTable({ data }: { data: TeamWeeklyEarnings }) {
  const { weeks, rows, perWeekTotals, perWeekApprovedTotals, grandTotalEarning } = data;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Bidder</TableHead>
            {weeks.map((w) => (
              <TableHead key={w.key} className="whitespace-nowrap text-right">
                Wk of {w.label}
              </TableHead>
            ))}
            <TableHead className="whitespace-nowrap text-right">All-time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell>
                <div className="whitespace-nowrap font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{usd(r.rate)}/app</div>
              </TableCell>
              {r.perWeekEarning.map((e, i) => (
                <TableCell
                  key={weeks[i].key}
                  className="text-right tabular-nums"
                  title={`${r.perWeekApproved[i]} approved`}
                >
                  {e > 0 ? usd(e) : <span className="text-muted-foreground">—</span>}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {usd(r.totalEarning)}
              </TableCell>
            </TableRow>
          ))}

          <TableRow className="border-t-2 border-border">
            <TableCell className="whitespace-nowrap font-semibold text-foreground">Team total</TableCell>
            {perWeekTotals.map((t, i) => (
              <TableCell
                key={weeks[i].key}
                className="text-right font-semibold tabular-nums text-foreground"
                title={`${perWeekApprovedTotals[i]} approved`}
              >
                {t > 0 ? usd(t) : <span className="text-muted-foreground">—</span>}
              </TableCell>
            ))}
            <TableCell className="text-right font-semibold tabular-nums text-foreground">
              {usd(grandTotalEarning)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
