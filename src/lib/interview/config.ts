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

export async function listStages(includeInactive = true): Promise<StageView[]> {
  const rows = await db.interviewStage.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveStages = () => listStages(false);

export async function createStage(label: string): Promise<string> {
  const sortOrder = await db.interviewStage.count();
  const row = await db.interviewStage.create({ data: { label: label.trim(), sortOrder } });
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

export async function moveStage(id: string, direction: Direction): Promise<void> {
  const rows = await db.interviewStage.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  const swap = neighborSwap(rows, id, direction);
  if (!swap) return;
  await db.$transaction([
    db.interviewStage.update({ where: { id: swap.a.id }, data: { sortOrder: swap.b.sortOrder } }),
    db.interviewStage.update({ where: { id: swap.b.id }, data: { sortOrder: swap.a.sortOrder } }),
  ]);
}

// ── Statuses (carry a color) ───────────────────────────

export async function listStatuses(includeInactive = true): Promise<StatusView[]> {
  const rows = await db.interviewStatus.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, color: r.color, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveStatuses = () => listStatuses(false);

export async function createStatus(input: StatusConfigInput): Promise<string> {
  const sortOrder = await db.interviewStatus.count();
  const row = await db.interviewStatus.create({
    data: { label: input.label.trim(), color: input.color, sortOrder },
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

export async function moveStatus(id: string, direction: Direction): Promise<void> {
  const rows = await db.interviewStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
  const swap = neighborSwap(rows, id, direction);
  if (!swap) return;
  await db.$transaction([
    db.interviewStatus.update({ where: { id: swap.a.id }, data: { sortOrder: swap.b.sortOrder } }),
    db.interviewStatus.update({ where: { id: swap.b.id }, data: { sortOrder: swap.a.sortOrder } }),
  ]);
}

// ── Meeting types ──────────────────────────────────────

export async function listMeetingTypes(includeInactive = true): Promise<MeetingTypeView[]> {
  const rows = await db.interviewMeetingType.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, sortOrder: r.sortOrder, active: r.active }));
}

export const listActiveMeetingTypes = () => listMeetingTypes(false);

export async function createMeetingType(label: string): Promise<string> {
  const sortOrder = await db.interviewMeetingType.count();
  const row = await db.interviewMeetingType.create({ data: { label: label.trim(), sortOrder } });
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

export async function moveMeetingType(id: string, direction: Direction): Promise<void> {
  const rows = await db.interviewMeetingType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } });
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
