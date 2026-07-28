"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveAvailabilityAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { DAY_LABELS, HOURS, hourLabel, slotKey, parseSlotKey } from "./labels";
import type { AvailabilitySlot } from "@/lib/interview/availability";

/**
 * Caller weekly-availability editor. A Sun–Sat × 24h grid; click or click-drag
 * to paint availability, click a day/hour header to toggle a whole column/row.
 * Save replaces the caller's stored set.
 */
export function AvailabilityEditor({
  initialSlots,
  timezone,
}: {
  initialSlots: AvailabilitySlot[];
  timezone: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSlots.map((s) => slotKey(s.dayOfWeek, s.hour)))
  );
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<{ error?: string; success?: boolean }>({});
  const [pending, startTransition] = useTransition();

  // Drag-paint: on pointer-down we decide whether we're adding or removing, then
  // apply that to every cell the pointer enters until release.
  const paintValue = useRef<boolean | null>(null);

  useEffect(() => {
    const stop = () => (paintValue.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const mutate = (fn: (next: Set<string>) => void) => {
    setSelected((prev) => {
      const next = new Set(prev);
      fn(next);
      return next;
    });
    setDirty(true);
    setState({});
  };

  const applyCell = (key: string, value: boolean) =>
    mutate((next) => (value ? next.add(key) : next.delete(key)));

  const startPaint = (day: number, hour: number) => {
    const key = slotKey(day, hour);
    const value = !selected.has(key);
    paintValue.current = value;
    applyCell(key, value);
  };

  const paintEnter = (day: number, hour: number) => {
    if (paintValue.current === null) return;
    applyCell(slotKey(day, hour), paintValue.current);
  };

  const toggleColumn = (day: number) => {
    const allOn = HOURS.every((h) => selected.has(slotKey(day, h)));
    mutate((next) => HOURS.forEach((h) => (allOn ? next.delete(slotKey(day, h)) : next.add(slotKey(day, h)))));
  };

  const toggleRow = (hour: number) => {
    const allOn = DAY_LABELS.every((_, d) => selected.has(slotKey(d, hour)));
    mutate((next) => DAY_LABELS.forEach((_, d) => (allOn ? next.delete(slotKey(d, hour)) : next.add(slotKey(d, hour)))));
  };

  const clearAll = () => mutate((next) => next.clear());

  const save = () => {
    const slots = Array.from(selected).map(parseSlotKey);
    startTransition(async () => {
      const result = await saveAvailabilityAction(slots);
      setState(result);
      if (result.success) setDirty(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selected.size} hour{selected.size === 1 ? "" : "s"} selected · times in {timezone}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={clearAll} disabled={pending || selected.size === 0}>
            Clear all
          </Button>
          <Button type="button" size="sm" onClick={save} loading={pending} disabled={!dirty}>
            {pending ? "Saving…" : "Save availability"}
          </Button>
        </div>
      </div>

      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.success && <Alert variant="success">Availability saved.</Alert>}

      <div className="overflow-x-auto">
        <table className="min-w-[40rem] border-separate border-spacing-0.5 select-none">
          <thead>
            <tr>
              <th className="w-16" />
              {DAY_LABELS.map((d, day) => (
                <th key={d} className="px-1 pb-1">
                  <button
                    type="button"
                    onClick={() => toggleColumn(day)}
                    className="w-full rounded text-xs font-medium text-muted-foreground hover:text-foreground"
                    title={`Toggle all ${d}`}
                  >
                    {d}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="pr-2 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => toggleRow(hour)}
                    className="text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
                    title={`Toggle all ${hourLabel(hour)}`}
                  >
                    {hourLabel(hour)}
                  </button>
                </td>
                {DAY_LABELS.map((_, day) => {
                  const on = selected.has(slotKey(day, hour));
                  return (
                    <td key={day} className="p-0">
                      <button
                        type="button"
                        aria-label={`${DAY_LABELS[day]} ${hourLabel(hour)}`}
                        aria-pressed={on}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          startPaint(day, hour);
                        }}
                        onPointerEnter={() => paintEnter(day, hour)}
                        className={cn(
                          "h-6 w-full min-w-10 rounded border transition-colors",
                          on
                            ? "border-primary bg-primary/80 hover:bg-primary"
                            : "border-border bg-card hover:bg-muted"
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: click and drag to paint multiple hours, or click a day / hour label to toggle a whole column or row.
      </p>
    </div>
  );
}
