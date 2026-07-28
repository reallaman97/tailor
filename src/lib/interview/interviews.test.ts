import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import type { UserRole } from "@/generated/prisma/client";
import {
  createInterview,
  getInterview,
  listInterviews,
  updateInterview,
  softDeleteInterview,
  assignCaller,
  updateStatus,
  addComment,
  addReferenceFile,
  getReferenceFile,
  deleteReferenceFile,
  setResumeFile,
  getResumeFile,
  getApplicationPrefill,
  InterviewNotFoundError,
  InvalidCallerError,
  InvalidFileError,
  type InterviewAccess,
  type InterviewWriteInput,
} from "@/lib/interview/interviews";

async function createUserWithRole(role: UserRole): Promise<string> {
  const { id } = await createTestUser();
  await db.user.update({ where: { id }, data: { role } });
  return id;
}

function baseInput(overrides: Partial<InterviewWriteInput> = {}): InterviewWriteInput {
  return {
    jobTitle: "Backend Engineer",
    companyName: "Acme Corp",
    jobDescription: "Build things.",
    scheduledAt: new Date("2026-08-01T15:00:00.000Z"),
    meta: {},
    ...overrides,
  };
}

describe("interviews (integration)", () => {
  let managerId: string;
  let callerId: string;
  let otherCallerId: string;
  let manager: InterviewAccess;
  let caller: InterviewAccess;
  let otherCaller: InterviewAccess;

  beforeAll(async () => {
    managerId = await createUserWithRole("MANAGER");
    callerId = await createUserWithRole("CALLER");
    otherCallerId = await createUserWithRole("CALLER");
    manager = { id: managerId, role: "MANAGER" };
    caller = { id: callerId, role: "CALLER" };
    otherCaller = { id: otherCallerId, role: "CALLER" };
  });

  afterAll(async () => {
    await deleteTestUser(managerId);
    await deleteTestUser(callerId);
    await deleteTestUser(otherCallerId);
  });

  it("creates a from-scratch interview and reads it back", async () => {
    const id = await createInterview(managerId, {
      ...baseInput(),
      statusId: "status_scheduled",
      stageId: "stage_introduce",
    });

    const detail = await getInterview(manager, id);
    expect(detail).toMatchObject({
      id,
      jobTitle: "Backend Engineer",
      companyName: "Acme Corp",
      applicationId: null,
      profileId: null,
      hasResumeFile: false,
    });
    expect(detail?.status?.label).toBe("Scheduled");
    expect(detail?.stage?.label).toBe("Introduce");
    expect(detail?.scheduledAt?.toISOString()).toBe("2026-08-01T15:00:00.000Z");
  });

  it("scopes callers to only their assigned interviews", async () => {
    const id = await createInterview(managerId, baseInput({ callerId }));

    // Assigned caller sees it; the other caller does not; the manager does.
    expect(await getInterview(caller, id)).not.toBeNull();
    expect(await getInterview(otherCaller, id)).toBeNull();
    expect(await getInterview(manager, id)).not.toBeNull();

    const callerList = await listInterviews(caller);
    expect(callerList.every((i) => i.caller?.id === callerId)).toBe(true);
    expect(callerList.some((i) => i.id === id)).toBe(true);
    expect((await listInterviews(otherCaller)).some((i) => i.id === id)).toBe(false);
  });

  it("lets an assigned caller update status but not an unassigned one", async () => {
    const id = await createInterview(managerId, baseInput({ callerId, statusId: "status_scheduled" }));

    await updateStatus(caller, id, "status_done");
    expect((await getInterview(manager, id))?.status?.label).toBe("Done");

    await expect(updateStatus(otherCaller, id, "status_failed")).rejects.toBeInstanceOf(InterviewNotFoundError);
  });

  it("lets an assigned caller comment; comments carry author + timestamp", async () => {
    const id = await createInterview(managerId, baseInput({ callerId }));

    await addComment(caller, id, "Called the candidate, rescheduling.");
    await expect(addComment(otherCaller, id, "nope")).rejects.toBeInstanceOf(InterviewNotFoundError);

    const detail = await getInterview(manager, id);
    expect(detail?.comments).toHaveLength(1);
    expect(detail?.comments[0]).toMatchObject({ body: "Called the candidate, rescheduling." });
    expect(detail?.comments[0].authorName).toBeTruthy();
  });

  it("updates core fields (manager)", async () => {
    const id = await createInterview(managerId, baseInput());
    await updateInterview(id, baseInput({ jobTitle: "Staff Engineer", salaryRange: "$180k–$220k" }));

    const detail = await getInterview(manager, id);
    expect(detail?.jobTitle).toBe("Staff Engineer");
    expect(detail?.salaryRange).toBe("$180k–$220k");
  });

  it("assigns a caller and rejects assigning a non-caller", async () => {
    const id = await createInterview(managerId, baseInput());
    await assignCaller(id, callerId);
    expect((await getInterview(manager, id))?.caller?.id).toBe(callerId);

    await expect(assignCaller(id, managerId)).rejects.toBeInstanceOf(InvalidCallerError);
    await expect(createInterview(managerId, baseInput({ callerId: managerId }))).rejects.toBeInstanceOf(
      InvalidCallerError
    );

    // Unassign.
    await assignCaller(id, null);
    expect((await getInterview(manager, id))?.caller).toBeNull();
  });

  it("soft-deletes an interview so it disappears from reads", async () => {
    const id = await createInterview(managerId, baseInput());
    await softDeleteInterview(id);
    expect(await getInterview(manager, id)).toBeNull();
    expect((await listInterviews(manager)).some((i) => i.id === id)).toBe(false);
    await expect(softDeleteInterview(id)).rejects.toBeInstanceOf(InterviewNotFoundError);
  });

  it("stores and serves reference files, scoped to the assigned caller", async () => {
    const id = await createInterview(managerId, baseInput({ callerId }));
    await addReferenceFile(id, managerId, {
      data: Buffer.from("hello pdf"),
      filename: "brief.pdf",
      mimeType: "application/pdf",
    });

    const detail = await getInterview(manager, id);
    expect(detail?.referenceFiles).toHaveLength(1);
    const fileId = detail!.referenceFiles[0].id;

    const asCaller = await getReferenceFile(caller, id, fileId);
    expect(asCaller?.data.toString()).toBe("hello pdf");
    expect(await getReferenceFile(otherCaller, id, fileId)).toBeNull();

    await deleteReferenceFile(id, fileId);
    expect((await getInterview(manager, id))?.referenceFiles).toHaveLength(0);
  });

  it("rejects oversized or wrong-type files", async () => {
    const id = await createInterview(managerId, baseInput());
    await expect(
      addReferenceFile(id, managerId, { data: Buffer.from("x"), filename: "a.exe", mimeType: "application/x-msdownload" })
    ).rejects.toBeInstanceOf(InvalidFileError);
    await expect(
      addReferenceFile(id, managerId, {
        data: Buffer.alloc(9 * 1024 * 1024),
        filename: "big.pdf",
        mimeType: "application/pdf",
      })
    ).rejects.toBeInstanceOf(InvalidFileError);
  });

  it("stores and serves an uploaded resume file", async () => {
    const id = await createInterview(managerId, baseInput({ callerId }));
    await setResumeFile(id, { data: Buffer.from("resume-bytes"), filename: "cv.pdf", mimeType: "application/pdf" });

    expect((await getInterview(manager, id))?.hasResumeFile).toBe(true);
    const file = await getResumeFile(caller, id);
    expect(file?.data.toString()).toBe("resume-bytes");
    expect(await getResumeFile(otherCaller, id)).toBeNull();
  });

  it("links to a source application and derives its profile", async () => {
    const application = await db.resume.create({
      data: {
        userId: managerId,
        companyName: "Globex",
        jobTitle: "SRE",
        jobDescription: "Keep the lights on.",
      },
      select: { id: true },
    });

    const prefill = await getApplicationPrefill(application.id);
    expect(prefill).toMatchObject({ companyName: "Globex", jobTitle: "SRE" });

    const id = await createInterview(managerId, { ...baseInput(), applicationId: application.id });
    const detail = await getInterview(manager, id);
    expect(detail?.applicationId).toBe(application.id);

    await db.resume.delete({ where: { id: application.id } });
  });
});
