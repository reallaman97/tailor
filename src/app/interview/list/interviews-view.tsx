"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CalendarIcon, ChevronLeftIcon, CopyIcon, TrashIcon } from "@/components/icons";
import { InterviewStatusPill } from "@/app/interview/status-pill";
import { zonedDayKey, zonedYmd, formatInterviewClock, formatInterviewTime } from "@/lib/interview/timezone";
import { cn } from "@/lib/utils";
import { duplicateInterviewAction, deleteInterviewAction } from "./actions";
import type { InterviewSummary } from "@/lib/interview/interviews";

type Option = { id: string; label: string };
type Mode = "day" | "week" | "all";
type Ymd = { year: number; month: number; day: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utcOf = ({ year, month, day }: Ymd) => Date.UTC(year, month - 1, day);
const ymdOf = (ms: number): Ymd => {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};
function weekDays(anchor: Ymd): Ymd[] {
  const base = utcOf(anchor);
  const start = base - new Date(base).getUTCDay() * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => ymdOf(start + i * DAY_MS));
}

/**
 * Interviews list as a Day / Week / All agenda. Defaults to Today so the day's
 * meetings are front and center; Day and Week navigate by unit. Filter by
 * company, status, stage, caller (managers), and candidate profile.
 */
export function InterviewsView({
  interviews,
  timezone,
  isManager,
  statuses,
  stages,
  callers,
}: {
  interviews: InterviewSummary[];
  timezone: string;
  isManager: boolean;
  statuses: Option[];
  stages: Option[];
  callers: Option[];
}) {
  const router = useRouter();
  const todayYmd = useMemo(() => zonedYmd(new Date(), timezone), [timezone]);
  const todayKey = keyOf(todayYmd.year, todayYmd.month, todayYmd.day);

  const [mode, setMode] = useState<Mode>("day");
  const [anchor, setAnchor] = useState<Ymd>(todayYmd);
  const [company, setCompany] = useState("");
  const [statusId, setStatusId] = useState("");
  const [stageId, setStageId] = useState("");
  const [callerId, setCallerId] = useState("");
  const [profileId, setProfileId] = useState("");

  // Profile filter options are the distinct candidate profiles in the visible set.
  const profiles = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of interviews) if (i.profile) m.set(i.profile.id, i.profile.name);
    return [...m].map(([id, label]) => ({ id, label }));
  }, [interviews]);

  const filtered = useMemo(
    () =>
      interviews.filter((i) => {
        if (company && !i.companyName.toLowerCase().includes(company.toLowerCase())) return false;
        if (statusId && i.status?.id !== statusId) return false;
        if (stageId && i.stage?.id !== stageId) return false;
        if (callerId && i.caller?.id !== callerId) return false;
        if (profileId && i.profile?.id !== profileId) return false;
        return true;
      }),
    [interviews, company, statusId, stageId, callerId, profileId]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, InterviewSummary[]>();
    for (const i of filtered) {
      if (!i.scheduledAt) continue;
      const key = zonedDayKey(i.scheduledAt, timezone);
      (map.get(key) ?? map.set(key, []).get(key)!).push(i);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime());
    return map;
  }, [filtered, timezone]);

  const step = (delta: number) =>
    setAnchor((a) => ymdOf(utcOf(a) + delta * (mode === "week" ? 7 : 1) * DAY_MS));

  return (
    <div className="flex flex-col gap-4">
      {/* Mode + date navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeToggle mode={mode} onChange={setMode} />
        {mode !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{rangeLabel(mode, anchor, todayKey)}</span>
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
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Company">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Search…" className="h-8 w-40" />
        </FilterField>
        <FilterField label="Status">
          <FilterSelect value={statusId} onChange={setStatusId} options={statuses} allLabel="All statuses" />
        </FilterField>
        <FilterField label="Stage">
          <FilterSelect value={stageId} onChange={setStageId} options={stages} allLabel="All stages" />
        </FilterField>
        {isManager && (
          <FilterField label="Caller">
            <FilterSelect value={callerId} onChange={setCallerId} options={callers} allLabel="All callers" />
          </FilterField>
        )}
        <FilterField label="Profile">
          <FilterSelect value={profileId} onChange={setProfileId} options={profiles} allLabel="All profiles" />
        </FilterField>
      </div>

      {/* Content */}
      {mode === "day" && <DayAgenda dayKey={keyOf(anchor.year, anchor.month, anchor.day)} byDay={byDay} timezone={timezone} isManager={isManager} onOpen={(id) => router.push(`/interview/${id}`)} />}
      {mode === "week" && <WeekAgenda anchor={anchor} byDay={byDay} todayKey={todayKey} timezone={timezone} isManager={isManager} onOpen={(id) => router.push(`/interview/${id}`)} />}
      {mode === "all" && <AllAgenda interviews={filtered} timezone={timezone} isManager={isManager} onOpen={(id) => router.push(`/interview/${id}`)} />}
    </div>
  );
}

// ── Agendas ────────────────────────────────────────────

function DayAgenda({
  dayKey,
  byDay,
  timezone,
  isManager,
  onOpen,
}: {
  dayKey: string;
  byDay: Map<string, InterviewSummary[]>;
  timezone: string;
  isManager: boolean;
  onOpen: (id: string) => void;
}) {
  const items = byDay.get(dayKey) ?? [];
  if (items.length === 0) {
    return <EmptyState icon={CalendarIcon} title="No interviews this day" description="Use the arrows to browse other days, or switch to Week or All." />;
  }
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((i) => (
        <AgendaRow key={i.id} interview={i} timezone={timezone} isManager={isManager} onOpen={onOpen} />
      ))}
    </div>
  );
}

function WeekAgenda({
  anchor,
  byDay,
  todayKey,
  timezone,
  isManager,
  onOpen,
}: {
  anchor: Ymd;
  byDay: Map<string, InterviewSummary[]>;
  todayKey: string;
  timezone: string;
  isManager: boolean;
  onOpen: (id: string) => void;
}) {
  const days = weekDays(anchor);
  const total = days.reduce((n, d) => n + (byDay.get(keyOf(d.year, d.month, d.day))?.length ?? 0), 0);
  if (total === 0) {
    return <EmptyState icon={CalendarIcon} title="No interviews this week" description="Use the arrows to browse other weeks, or switch to All." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((d) => {
        const key = keyOf(d.year, d.month, d.day);
        const items = byDay.get(key) ?? [];
        if (items.length === 0) return null;
        const isToday = key === todayKey;
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
              {WEEKDAYS[new Date(utcOf(d)).getUTCDay()]}, {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(utcOf(d)))}
              {isToday && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">Today</span>}
            </div>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {items.map((i) => (
                <AgendaRow key={i.id} interview={i} timezone={timezone} isManager={isManager} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AllAgenda({
  interviews,
  timezone,
  isManager,
  onOpen,
}: {
  interviews: InterviewSummary[];
  timezone: string;
  isManager: boolean;
  onOpen: (id: string) => void;
}) {
  // Scheduled first (newest→oldest), then unscheduled.
  const sorted = [...interviews].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) return b.scheduledAt.getTime() - a.scheduledAt.getTime();
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  if (sorted.length === 0) {
    return <EmptyState icon={CalendarIcon} title="No interviews match" description="Try clearing a filter." />;
  }
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {sorted.map((i) => (
        <AgendaRow key={i.id} interview={i} timezone={timezone} isManager={isManager} onOpen={onOpen} showDate />
      ))}
    </div>
  );
}

function AgendaRow({
  interview: i,
  timezone,
  isManager,
  onOpen,
  showDate,
}: {
  interview: InterviewSummary;
  timezone: string;
  isManager: boolean;
  onOpen: (id: string) => void;
  showDate?: boolean;
}) {
  const when = i.scheduledAt
    ? showDate
      ? formatInterviewTime(i.scheduledAt, timezone)
      : formatInterviewClock(i.scheduledAt, timezone)
    : "Unscheduled";
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
      <button type="button" onClick={() => onOpen(i.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-28 shrink-0 text-sm font-medium text-muted-foreground">{when}</span>
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: i.status?.color ?? "#94a3b8" }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {i.companyName} — {i.jobTitle}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {i.stage && <span className="rounded border border-border bg-muted px-1 py-px font-medium">{i.stage.label}</span>}
            {i.caller && <span>{i.caller.name}</span>}
            {i.profile && <span>· {i.profile.name}</span>}
          </span>
        </span>
      </button>
      <InterviewStatusPill status={i.status} />
      {isManager && <RowActions id={i.id} />}
    </div>
  );
}

function RowActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Link
        href={`/interview/${id}`}
        aria-label="Edit interview"
        className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
      >
        Edit
      </Link>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        loading={pending}
        aria-label="Duplicate interview"
        title="Duplicate"
        onClick={() => startTransition(async () => { await duplicateInterviewAction(id); })}
      >
        <CopyIcon className="size-4" />
      </Button>
      <ConfirmDialog
        title="Delete this interview?"
        description="It will be removed from the calendar and lists. An admin can recover it if needed."
        confirmLabel="Delete"
        triggerVariant="ghost"
        triggerSize="icon"
        triggerClassName="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        triggerLabel="Delete interview"
        triggerContent={<TrashIcon className="size-4" />}
        action={deleteInterviewAction.bind(null, id)}
      />
    </div>
  );
}

// ── Controls ───────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const modes: { key: Mode; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "all", label: "All" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {modes.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          aria-pressed={mode === m.key}
          className={cn(
            "rounded px-3 py-1 text-sm font-medium transition-colors",
            mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-44 text-sm">
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function rangeLabel(mode: Mode, anchor: Ymd, todayKey: string): string {
  if (mode === "day") {
    const key = keyOf(anchor.year, anchor.month, anchor.day);
    const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(utcOf(anchor)));
    return key === todayKey ? `Today · ${label}` : label;
  }
  const days = weekDays(anchor);
  const fmt = (y: Ymd, withYear: boolean) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(utcOf(y)));
  return `${fmt(days[0], days[0].year !== days[6].year)} – ${fmt(days[6], true)}`;
}
