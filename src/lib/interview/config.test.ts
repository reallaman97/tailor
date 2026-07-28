import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  listStages,
  listActiveStages,
  createStage,
  renameStage,
  setStageActive,
  moveStage,
  listStatuses,
  createStatus,
  updateStatus,
  setStatusActive,
  ConfigItemNotFoundError,
} from "@/lib/interview/config";

describe("interview config (integration)", () => {
  const createdStageIds: string[] = [];
  const createdStatusIds: string[] = [];

  afterAll(async () => {
    await db.interviewStage.deleteMany({ where: { id: { in: createdStageIds } } });
    await db.interviewStatus.deleteMany({ where: { id: { in: createdStatusIds } } });
  });

  it("creates a stage that appends at the end and is active by default", async () => {
    const before = await listStages();
    const id = await createStage("Take-home");
    createdStageIds.push(id);

    const all = await listStages();
    const created = all.find((s) => s.id === id);
    expect(created).toMatchObject({ label: "Take-home", active: true });
    // Appended after everything that existed before.
    expect(created!.sortOrder).toBeGreaterThanOrEqual(before.length);
  });

  it("renames a stage and errors on an unknown id", async () => {
    const id = await createStage("Onsite loop");
    createdStageIds.push(id);
    await renameStage(id, "Onsite panel");
    const all = await listStages();
    expect(all.find((s) => s.id === id)?.label).toBe("Onsite panel");

    await expect(renameStage("does-not-exist", "x")).rejects.toBeInstanceOf(ConfigItemNotFoundError);
  });

  it("deactivating a stage hides it from the active list but keeps the row", async () => {
    const id = await createStage("Legacy stage");
    createdStageIds.push(id);

    await setStageActive(id, false);
    expect((await listActiveStages()).find((s) => s.id === id)).toBeUndefined();
    expect((await listStages()).find((s) => s.id === id)).toBeDefined();
  });

  it("moves a stage up and down by swapping order with its neighbor", async () => {
    const a = await createStage("Order A");
    const b = await createStage("Order B");
    createdStageIds.push(a, b);

    const orderOf = async (id: string) => (await listStages()).findIndex((s) => s.id === id);
    const aIdx = await orderOf(a);
    const bIdx = await orderOf(b);
    expect(bIdx).toBe(aIdx + 1);

    await moveStage(b, "up");
    expect(await orderOf(b)).toBe(aIdx);
    expect(await orderOf(a)).toBe(aIdx + 1);

    await moveStage(b, "down");
    expect(await orderOf(a)).toBe(aIdx);
    expect(await orderOf(b)).toBe(aIdx + 1);
  });

  it("creates and updates a status with a color", async () => {
    const id = await createStatus({ label: "On hold", color: "#a855f7" });
    createdStatusIds.push(id);

    let row = (await listStatuses()).find((s) => s.id === id);
    expect(row).toMatchObject({ label: "On hold", color: "#a855f7", active: true });

    await updateStatus(id, { label: "Paused", color: "#f97316" });
    row = (await listStatuses()).find((s) => s.id === id);
    expect(row).toMatchObject({ label: "Paused", color: "#f97316" });

    await setStatusActive(id, false);
    expect((await listStatuses(false)).find((s) => s.id === id)).toBeUndefined();
  });

  it("seeds the default stages and statuses via migration", async () => {
    const stages = await listStages();
    expect(stages.some((s) => s.label === "Introduce")).toBe(true);
    expect(stages.some((s) => s.label === "Final")).toBe(true);

    const statuses = await listStatuses();
    expect(statuses.some((s) => s.label === "Scheduled")).toBe(true);
  });
});
