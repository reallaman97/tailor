"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { DAY_LABELS, HOURS, hourLabel, slotKey } from "./labels";
import type { AvailabilityOverview } from "@/lib/interview/availability";

/**
 * Admin view of caller availability: an aggregate heatmap (how many callers are
 * free at each slot — the "total"), each caller's submitted total, and a picker
 * to inspect one caller's full weekly grid.
 */
export function AvailabilityAdmin({
  overview,
  timezone,
}: {
  overview: AvailabilityOverview;
  timezone: string;
}) {
  const { callers, totals, callerCount, maxCount } = overview;
  const [selectedId, setSelectedId] = useState<string>("");

  const selected = callers.find((c) => c.id === selectedId) ?? null;
  const selectedSet = useMemo(
    () => new Set(selected?.slots.map((s) => slotKey(s.dayOfWeek, s.hour)) ?? []),
    [selected]
  );
  const submittedCount = callers.filter((c) => c.totalHours > 0).length;

  if (callerCount === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No callers yet"
        description="Once accounts have the Caller role, their availability shows up here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Team availability</CardTitle>
          <CardDescription>
            How many of your {callerCount} caller{callerCount === 1 ? "" : "s"} are free at each hour ({submittedCount}{" "}
            submitted). Times in {timezone}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HeatmapGrid totals={totals} maxCount={maxCount} />
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Fewer</span>
            <div className="flex">
              {[0.15, 0.35, 0.55, 0.75, 1].map((a) => (
                <span key={a} className="h-3 w-6" style={{ backgroundColor: heatColor(a) }} />
              ))}
            </div>
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By caller</CardTitle>
          <CardDescription>Total submitted hours per caller. Pick one to see their full week.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Weekly hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callers.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(c.id === selectedId ? "" : c.id)}
                  >
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.totalHours > 0 ? c.totalHours : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View a caller’s grid:</span>
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="h-8 w-56 text-sm">
              <option value="">Select a caller…</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.totalHours}h)
                </option>
              ))}
            </Select>
          </div>

          {selected && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {selected.name} — {selected.totalHours} hour{selected.totalHours === 1 ? "" : "s"}/week
              </p>
              <CallerGrid selectedSet={selectedSet} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HeatmapGrid({ totals, maxCount }: { totals: number[][]; maxCount: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[40rem] border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-16" />
            {DAY_LABELS.map((d) => (
              <th key={d} className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <td className="pr-2 text-right text-[11px] tabular-nums text-muted-foreground">{hourLabel(hour)}</td>
              {DAY_LABELS.map((_, day) => {
                const count = totals[day][hour];
                const alpha = maxCount ? count / maxCount : 0;
                return (
                  <td key={day} className="p-0">
                    <div
                      title={`${count} available · ${DAY_LABELS[day]} ${hourLabel(hour)}`}
                      className="flex h-6 min-w-10 items-center justify-center rounded border border-border text-[10px] font-medium"
                      style={{
                        backgroundColor: count ? heatColor(Math.max(alpha, 0.12)) : undefined,
                        color: alpha > 0.55 ? "white" : undefined,
                      }}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CallerGrid({ selectedSet }: { selectedSet: Set<string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[40rem] border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-16" />
            {DAY_LABELS.map((d) => (
              <th key={d} className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <td className="pr-2 text-right text-[11px] tabular-nums text-muted-foreground">{hourLabel(hour)}</td>
              {DAY_LABELS.map((_, day) => {
                const on = selectedSet.has(slotKey(day, hour));
                return (
                  <td key={day} className="p-0">
                    <div
                      className={cn("h-6 min-w-10 rounded border", on ? "border-primary bg-primary/80" : "border-border bg-card")}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Blue heat with the given alpha (0–1). */
function heatColor(alpha: number): string {
  return `rgba(59, 130, 246, ${alpha})`;
}
