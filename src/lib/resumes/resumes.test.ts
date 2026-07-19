import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import {
  createResume,
  listResumes,
  getResume,
  updateResumeStatus,
  deleteResume,
  ResumeNotFoundError,
} from "@/lib/resumes/resumes";

describe("resumes (integration)", () => {
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
    ({ id: otherUserId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    await deleteTestUser(otherUserId);
  });

  it("returns an empty list for a new user", async () => {
    expect(await listResumes(userId)).toEqual([]);
  });

  it("creates a resume with DRAFT status by default", async () => {
    const id = await createResume(userId, {
      jobLink: "https://example.com/jobs/123",
      companyName: "Acme Corp",
      jobTitle: "Senior Engineer",
      jobDescription: "We are looking for a senior engineer with 5+ years of experience.",
    });

    const detail = await getResume(userId, id);
    expect(detail).toMatchObject({
      id,
      companyName: "Acme Corp",
      jobTitle: "Senior Engineer",
      jobLink: "https://example.com/jobs/123",
      status: "DRAFT",
      appliedAt: null,
      generatedAt: null,
    });
  });

  it("lists resumes newest-first", async () => {
    const idA = await createResume(userId, {
      jobLink: undefined,
      companyName: "Globex",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    const list = await listResumes(userId);
    expect(list[0].id).toBe(idA);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("updates status and sets appliedAt exactly once, on first transition to APPLIED", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Initech",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await updateResumeStatus(userId, id, "APPLIED");
    const afterApply = await getResume(userId, id);
    expect(afterApply?.status).toBe("APPLIED");
    const firstAppliedAt = afterApply?.appliedAt;
    expect(firstAppliedAt).not.toBeNull();

    await updateResumeStatus(userId, id, "INTERVIEWING");
    const afterInterviewing = await getResume(userId, id);
    expect(afterInterviewing?.status).toBe("INTERVIEWING");
    expect(afterInterviewing?.appliedAt).toEqual(firstAppliedAt);

    await updateResumeStatus(userId, id, "APPLIED");
    const backToApplied = await getResume(userId, id);
    expect(backToApplied?.appliedAt).toEqual(firstAppliedAt);
  });

  it("deletes a resume", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "ToDelete Inc",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await deleteResume(userId, id);
    expect(await getResume(userId, id)).toBeNull();
  });

  it("does not allow one user to read, update, or delete another user's resume", async () => {
    const id = await createResume(otherUserId, {
      jobLink: undefined,
      companyName: "Other Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    expect(await getResume(userId, id)).toBeNull();
    await expect(updateResumeStatus(userId, id, "APPLIED")).rejects.toThrow(ResumeNotFoundError);
    await expect(deleteResume(userId, id)).rejects.toThrow(ResumeNotFoundError);

    const stillThere = await getResume(otherUserId, id);
    expect(stillThere).not.toBeNull();
  });
});
