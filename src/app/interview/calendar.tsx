"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "@/components/icons";
import { InterviewStatusPill } from "@/app/interview/status-pill";
import { zonedDayKey, zonedYmd, formatInterviewClock } from "@/lib/interview/timezone";
import { cn } from "@/lib/utils";
import type { InterviewSummary } from "@/lib/interview/interviews";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

type Mode = "month" | "week" | "day";
type Ymd = { year: number; month: number; day: number }; // month 1-12

const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utcOf = ({ year, month, day }: Ymd) => Date.UTC(year, month - 1, day);
const ymdOf = (ms: number): Ymd => {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

/**
 * Interview calendar with Month / Week / Day views. Grid dates are computed with
 * UTC math (so they never drift), while each interview is bucketed onto the day
 * it falls on *in the configured timezone* (zonedDayKey) — matching how times
 * display everywhere else. Navigation steps by the active unit.
 */
export function InterviewCalendar({
  interviews,
  timezone,
}: {
  interviews: InterviewSummary[];
  timezone: string;
}) {
  const router = useRouter();

  const todayYmd = useMemo(() => zonedYmd(new Date(), timezone), [timezone]);
  const todayKey = keyOf(todayYmd.year, todayYmd.month, todayYmd.day);

  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState<Ymd>(todayYmd);

  const byDay = useMemo(() => {
    const map = new Map<string, InterviewSummary[]>();
    for (const i of interviews) {
      if (!i.scheduledAt) continue;
      const key = zonedDayKey(i.scheduledAt, timezone);
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
    }
    return map;
  }, [interviews, timezone]);

  const unscheduled = useMemo(() => interviews.filter((i) => !i.scheduledAt), [interviews]);

  const open = (id: string) => router.push(`/interview/${id}`);

  // Navigation steps by the active unit.
  const step = (delta: number) => {
    setAnchor((a) => {
      if (mode === "month") {
        const next = a.month - 1 + delta;
        const year = a.year + Math.floor(next / 12);
        const month = ((next % 12) + 12) % 12 + 1;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return { year, month, day: Math.min(a.day, lastDay) };
      }
      return ymdOf(utcOf(a) + delta * (mode === "week" ? 7 : 1) * DAY_MS);
    });
  };

  const label = useMemo(() => headerLabel(mode, anchor), [mode, anchor]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle mode={mode} onChange={setMode} />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(todayYmd)}>
              Today
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => step(1)} aria-label="Next">
              <ChevronLeftIcon className="size-4 rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      {mode === "month" && (
        <MonthView anchor={anchor} byDay={byDay} todayKey={todayKey} timezone={timezone} onOpen={open} />
      )}
      {mode === "week" && (
        <WeekView anchor={anchor} byDay={byDay} todayKey={todayKey} timezone={timezone} onOpen={open} />
      )}
      {mode === "day" && (
        <DayView anchor={anchor} byDay={byDay} todayKey={todayKey} timezone={timezone} onOpen={open} />
      )}

      {unscheduled.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
          <span className="text-xs font-medium text-muted-foreground">Unscheduled ({unscheduled.length})</span>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => open(i.id)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
                style={{ borderLeft: `3px solid ${i.status?.color ?? "#94a3b8"}` }}
              >
                {i.companyName} — {i.jobTitle}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Views ──────────────────────────────────────────────

type ViewProps = {
  anchor: Ymd;
  byDay: Map<string, InterviewSummary[]>;
  todayKey: string;
  timezone: string;
  onOpen: (id: string) => void;
};

function MonthView({ anchor, byDay, todayKey, timezone, onOpen }: ViewProps) {
  const m0 = anchor.month - 1;
  const firstWeekday = new Date(Date.UTC(anchor.year, m0, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(anchor.year, m0 + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-px rounded-lg border border-border bg-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="min-h-24 bg-background/40" />;
          const key = keyOf(anchor.year, anchor.month, day);
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={idx} className="min-h-24 bg-card p-1.5">
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {day}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((i) => (
                  <EventChip key={i.id} interview={i} timezone={timezone} onOpen={onOpen} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ anchor, byDay, todayKey, timezone, onOpen }: ViewProps) {
  const days = weekDays(anchor);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-px rounded-lg border border-border bg-border">
        {days.map((d) => {
          const key = keyOf(d.year, d.month, d.day);
          const isToday = key === todayKey;
          const weekday = new Date(utcOf(d)).getUTCDay();
          return (
            <div key={key} className="bg-card px-2 py-1.5 text-center">
              <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS[weekday]}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm",
                  isToday ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"
                )}
              >
                {d.day}
              </div>
            </div>
          );
        })}
        {days.map((d) => {
          const key = keyOf(d.year, d.month, d.day);
          const items = byDay.get(key) ?? [];
          return (
            <div key={`body-${key}`} className="min-h-[16rem] bg-card p-1.5">
              <div className="flex flex-col gap-1">
                {items.length === 0 && <span className="px-1 text-[11px] text-muted-foreground">—</span>}
                {items.map((i) => (
                  <EventChip key={i.id} interview={i} timezone={timezone} onOpen={onOpen} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ anchor, byDay, todayKey, timezone, onOpen }: ViewProps) {
  const key = keyOf(anchor.year, anchor.month, anchor.day);
  const items = byDay.get(key) ?? [];
  const isToday = key === todayKey;

  return (
    <div className="rounded-lg border border-border">
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-4 py-2 text-sm font-medium",
          isToday ? "text-primary" : "text-foreground"
        )}
      >
        {headerLabel("day", anchor)}
        {isToday && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Today</span>}
      </div>
      <div className="flex flex-col divide-y divide-border">
        {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No interviews.</p>}
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => onOpen(i.id)}
            className="flex items-center gap-3 px-4 py-3 text-left hover:bg-muted"
          >
            <span className="w-20 shrink-0 text-sm font-medium text-muted-foreground">
              {formatInterviewClock(i.scheduledAt, timezone)}
            </span>
            <span
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: i.status?.color ?? "#94a3b8" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {i.companyName} — {i.jobTitle}
              </span>
              {i.caller && <span className="text-xs text-muted-foreground">{i.caller.name}</span>}
            </span>
            <StageBadge stage={i.stage} />
            <InterviewStatusPill status={i.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Bits ───────────────────────────────────────────────

function EventChip({
  interview,
  timezone,
  onOpen,
}: {
  interview: InterviewSummary;
  timezone: string;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(interview.id)}
      title={`${interview.companyName} — ${interview.jobTitle}${interview.stage ? ` · ${interview.stage.label}` : ""}`}
      className="flex w-full flex-col gap-0.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted"
      style={{ borderLeft: `3px solid ${interview.status?.color ?? "#94a3b8"}` }}
    >
      <span className="flex items-center gap-1">
        <span className="shrink-0 text-muted-foreground">{formatInterviewClock(interview.scheduledAt, timezone)}</span>
        <StageBadge stage={interview.stage} />
      </span>
      <span className="truncate font-medium text-foreground">{interview.companyName}</span>
    </button>
  );
}

/** The interview process/type shown as a compact badge (Intro, Technical, Coding, Final, …). */
function StageBadge({ stage }: { stage: { label: string } | null }) {
  if (!stage) return null;
  return (
    <span className="shrink-0 truncate rounded border border-border bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">
      {stage.label}
    </span>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const modes: Mode[] = ["month", "week", "day"];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(
            "rounded px-3 py-1 text-sm font-medium capitalize transition-colors",
            mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/** The 7 days (Sun–Sat) of the week containing `anchor`. */
function weekDays(anchor: Ymd): Ymd[] {
  const anchorUtc = utcOf(anchor);
  const weekday = new Date(anchorUtc).getUTCDay();
  const startUtc = anchorUtc - weekday * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => ymdOf(startUtc + i * DAY_MS));
}

function headerLabel(mode: Mode, anchor: Ymd): string {
  if (mode === "month") {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
      new Date(utcOf({ ...anchor, day: 1 }))
    );
  }
  if (mode === "day") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(utcOf(anchor)));
  }
  // week → range "Jul 20 – Jul 26, 2026"
  const days = weekDays(anchor);
  const start = days[0];
  const end = days[6];
  const fmt = (y: Ymd, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(new Date(utcOf(y)));
  return `${fmt(start, start.year !== end.year)} – ${fmt(end, true)}`;
}
