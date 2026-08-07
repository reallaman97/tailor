import { db } from "@/lib/db";
import type { StatusConfigInput } from "@/lib/interview/schemas";

/**
 * The three config-driven lookup lists behind interviews: Interview Process
 * stages, Statuses (with a display color), and Meeting Types. Managers edit
 * these in Settings; nothing here is an enum, so options can be added, renamed,
 * reordered, and deactivated over time.
 *
 * Deactivating (active=false) rather than deleting is the norm — an interview
 * keeps its FK either way, so history never breaks. `active` only controls
 * whether an option is offered in new pickers. `listActive*` powers the form
 * pickers; the full `list*` powers Settings and any historical-value lookups.
 *
 * New rows append at the end via the `count()`-then-`sortOrder` idiom used
 * across the codebase (see src/lib/profile/skills.ts).
 */

const DEFAULT_STAGES = ["Introduce", "Technical", "Coding Test", "Culture", "Final"];
const DEFAULT_STATUSES: [label: string, color: string][] = [
  ["Scheduled", "#3b82f6"],
  ["Done", "#22c55e"],
  ["Rejected", "#ef4444"],
  ["Failed", "#f59e0b"],
];
const DEFAULT_MEETING_TYPES = ["Zoom", "Google Meet", "Phone", "Onsite"];

/** Seeds a new team's interview config lists (no-op if it already has stages). */
export async function seedTeamInterviewConfig(teamId: string): Promise<void> {
  if ((await db.interviewStage.count({ where: { teamId } })) > 0) return;
  await db.$transaction([
    ...DEFAULT_STAGES.map((label, i) => db.interviewStage.create({ data: { label, sortOrder: i, teamId } })),
    ...DEFAULT_STATUSES.map(([label, color], i) => db.interviewStatus.create({ data: { label, color, sortOrder: i, teamId } })),
    ...DEFAULT_MEETING_TYPES.map((label, i) => db.interviewMeetingType.create({ data: { label, sortOrder: i, teamId } })),
  ]);
}

export type StageView = { id: string; label: string; sortOrder: number; active: boolean };
export type StatusView = StageView & { color: string };
export type MeetingTypeView = StageView;

export class ConfigItemNotFoundError extends Error {
  constructor() {
    super("That option no longer exists");
  }
}

type Direction = "up" | "down";

// ── Stages ─────────────────────────────────────────────

export async function listStages(includeInactive = true, teamId?: string | null): Promise<StageView[]> {
  const rows = await db.interviewStage.findMany({
    where: { ...(teamId ? { teamId } : {}), ...(includeInactive ? {} : { active: true }) },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveStages = (teamId?: string | null) => listStages(false, teamId);

export async function createStage(label: string, teamId?: string | null): Promise<string> {
  const sortOrder = await db.interviewStage.count({ where: teamId ? { teamId } : {} });
  const row = await db.interviewStage.create({ data: { label: label.trim(), sortOrder, teamId: teamId ?? null } });
  return row.id;
}

export async function renameStage(id: string, label: string): Promise<void> {
  const result = await db.interviewStage.updateMany({ where: { id }, data: { label: label.trim() } });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function setStageActive(id: string, active: boolean): Promise<void> {
  const result = await db.interviewStage.updateMany({ where: { id }, data: { active } });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function moveStage(id: string, direction: Direction, teamId?: string | null): Promise<void> {
  const rows = await db.interviewStage.findMany({ where: teamId ? { teamId } : {}, orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  const swap = neighborSwap(rows, id, direction);
  if (!swap) return;
  await db.$transaction([
    db.interviewStage.update({ where: { id: swap.a.id }, data: { sortOrder: swap.b.sortOrder } }),
    db.interviewStage.update({ where: { id: swap.b.id }, data: { sortOrder: swap.a.sortOrder } }),
  ]);
}

// ── Statuses (carry a color) ───────────────────────────

export async function listStatuses(includeInactive = true, teamId?: string | null): Promise<StatusView[]> {
  const rows = await db.interviewStatus.findMany({
    where: { ...(teamId ? { teamId } : {}), ...(includeInactive ? {} : { active: true }) },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, color: r.color, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveStatuses = (teamId?: string | null) => listStatuses(false, teamId);

export async function createStatus(input: StatusConfigInput, teamId?: string | null): Promise<string> {
  const sortOrder = await db.interviewStatus.count({ where: teamId ? { teamId } : {} });
  const row = await db.interviewStatus.create({
    data: { label: input.label.trim(), color: input.color, sortOrder, teamId: teamId ?? null },
  });
  return row.id;
}

export async function updateStatus(id: string, input: StatusConfigInput): Promise<void> {
  const result = await db.interviewStatus.updateMany({
    where: { id },
    data: { label: input.label.trim(), color: input.color },
  });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function setStatusActive(id: string, active: boolean): Promise<void> {
  const result = await db.interviewStatus.updateMany({ where: { id }, data: { active } });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function moveStatus(id: string, direction: Direction, teamId?: string | null): Promise<void> {
  const rows = await db.interviewStatus.findMany({ where: teamId ? { teamId } : {}, orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  const swap = neighborSwap(rows, id, direction);
  if (!swap) return;
  await db.$transaction([
    db.interviewStatus.update({ where: { id: swap.a.id }, data: { sortOrder: swap.b.sortOrder } }),
    db.interviewStatus.update({ where: { id: swap.b.id }, data: { sortOrder: swap.a.sortOrder } }),
  ]);
}

// ── Meeting types ──────────────────────────────────────

export async function listMeetingTypes(includeInactive = true, teamId?: string | null): Promise<MeetingTypeView[]> {
  const rows = await db.interviewMeetingType.findMany({
    where: { ...(teamId ? { teamId } : {}), ...(includeInactive ? {} : { active: true }) },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveMeetingTypes = (teamId?: string | null) => listMeetingTypes(false, teamId);

export async function createMeetingType(label: string, teamId?: string | null): Promise<string> {
  const sortOrder = await db.interviewMeetingType.count({ where: teamId ? { teamId } : {} });
  const row = await db.interviewMeetingType.create({ data: { label: label.trim(), sortOrder, teamId: teamId ?? null } });
  return row.id;
}

export async function renameMeetingType(id: string, label: string): Promise<void> {
  const result = await db.interviewMeetingType.updateMany({ where: { id }, data: { label: label.trim() } });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function setMeetingTypeActive(id: string, active: boolean): Promise<void> {
  const result = await db.interviewMeetingType.updateMany({ where: { id }, data: { active } });
  if (result.count === 0) throw new ConfigItemNotFoundError();
}

export async function moveMeetingType(id: string, direction: Direction, teamId?: string | null): Promise<void> {
  const rows = await db.interviewMeetingType.findMany({ where: teamId ? { teamId } : {}, orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  const swap = neighborSwap(rows, id, direction);
  if (!swap) return;
  await db.$transaction([
    db.interviewMeetingType.update({ where: { id: swap.a.id }, data: { sortOrder: swap.b.sortOrder } }),
    db.interviewMeetingType.update({ where: { id: swap.b.id }, data: { sortOrder: swap.a.sortOrder } }),
  ]);
}

/**
 * Given rows ordered by sortOrder, returns the item `id` and its neighbor in
 * `direction` so their sortOrder values can be swapped — or null at the ends.
 */
function neighborSwap(
  rows: { id: string; sortOrder: number }[],
  id: string,
  direction: Direction
): { a: { id: string; sortOrder: number }; b: { id: string; sortOrder: number } } | null {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return null;
  return { a: rows[i], b: rows[j] };
}
