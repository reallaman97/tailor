import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { db } from "@/lib/db";
import {
  createResume,
  listResumes,
  getResume,
  uploadScreenshot,
  getScreenshot,
  DuplicateApplicationError,
  InvalidScreenshotError,
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

  it("creates a resume with DRAFT status and OTHER role track/source by default", async () => {
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
      statuses: ["DRAFT"],
      roleTrack: "OTHER",
      source: "OTHER",
      approvalStatus: "PENDING",
      hasScreenshot: false,
      appliedAt: null,
      generatedAt: null,
    });
  });

  it("accepts an explicit role track and source", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Hooli",
      jobTitle: "Backend Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
      roleTrack: "BACKEND",
      source: "RECRUITER",
    });

    const detail = await getResume(userId, id);
    expect(detail?.roleTrack).toBe("BACKEND");
    expect(detail?.source).toBe("RECRUITER");
  });

  it("rejects a duplicate application matched by job link, scoped to the same user (no profile assigned)", async () => {
    await createResume(userId, {
      jobLink: "https://example.com/jobs/dup",
      companyName: "Dup Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await expect(
      createResume(userId, {
        jobLink: "https://example.com/jobs/dup",
        companyName: "Dup Co (renamed)",
        jobTitle: "Different Title",
        jobDescription: "A description that is definitely long enough to pass validation.",
      })
    ).rejects.toThrow(DuplicateApplicationError);

    // A different user (no shared profile) logging the exact same link is not a duplicate for them.
    await expect(
      createResume(otherUserId, {
        jobLink: "https://example.com/jobs/dup",
        companyName: "Dup Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      })
    ).resolves.toBeTruthy();
  });

  it("falls back to company+title matching when no job link is given", async () => {
    await createResume(userId, {
      jobLink: undefined,
      companyName: "Umbrella Corp",
      jobTitle: "Platform Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await expect(
      createResume(userId, {
        jobLink: undefined,
        companyName: "umbrella corp",
        jobTitle: "platform engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      })
    ).rejects.toThrow(DuplicateApplicationError);
  });

  it("carries the existing application (id, company, title) on the duplicate error", async () => {
    const existingId = await createResume(userId, {
      jobLink: undefined,
      companyName: "Wonka Industries",
      jobTitle: "Chocolatier",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await expect(
      createResume(userId, {
        jobLink: undefined,
        companyName: "wonka industries",
        jobTitle: "chocolatier",
        jobDescription: "A description that is definitely long enough to pass validation.",
      })
    ).rejects.toMatchObject({
      existing: { id: existingId, companyName: "Wonka Industries", jobTitle: "Chocolatier" },
    });
  });

  it("catches a company+title duplicate even when the new entry has a job link the old one lacks", async () => {
    await createResume(userId, {
      jobLink: undefined,
      companyName: "No Link Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    // The existing record has no link at all, so a link-only check would miss
    // this — company+title must always be checked too, not just when the new
    // entry itself omits a link.
    await expect(
      createResume(userId, {
        jobLink: "https://example.com/jobs/new-link",
        companyName: "No Link Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      })
    ).rejects.toThrow(DuplicateApplicationError);
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

  it("filters listResumes by status/roleTrack/source", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Filter Co",
      jobTitle: "Data Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
      roleTrack: "DATA",
      source: "JOB_BOARD",
    });

    const byRoleTrack = await listResumes(userId, { roleTrack: "DATA" });
    expect(byRoleTrack.some((r) => r.id === id)).toBe(true);
    expect(byRoleTrack.every((r) => r.roleTrack === "DATA")).toBe(true);

    const bySource = await listResumes(userId, { source: "JOB_BOARD" });
    expect(bySource.some((r) => r.id === id)).toBe(true);

    const byStatus = await listResumes(userId, { status: "OFFER" });
    expect(byStatus.some((r) => r.id === id)).toBe(false);
  });

  it("creates directly at APPLIED (the normal-user/admin-builder flow) and sets appliedAt immediately", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Direct Apply Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
      roleTrack: "BACKEND",
      source: "JOB_BOARD",
      status: "APPLIED",
    });

    const detail = await getResume(userId, id);
    expect(detail?.statuses).toEqual(["APPLIED"]);
    expect(detail?.appliedAt).not.toBeNull();
  });

  it("reports the creating user's email as appliedByEmail", async () => {
    const { id: creatorId, email: creatorEmail } = await createTestUser();
    try {
      const id = await createResume(creatorId, {
        jobLink: undefined,
        companyName: "Applied By Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      });

      const detail = await getResume(creatorId, id);
      expect(detail?.appliedByEmail).toBe(creatorEmail);
    } finally {
      await deleteTestUser(creatorId);
    }
  });

  it("uploads a screenshot, resets approval to PENDING, and serves it back only within the same scope", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Screenshot Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    const png = Buffer.from("fake-png-bytes");
    await uploadScreenshot(userId, id, png, "image/png");

    const detail = await getResume(userId, id);
    expect(detail?.hasScreenshot).toBe(true);
    expect(detail?.approvalStatus).toBe("PENDING");

    const fetched = await getScreenshot(userId, id);
    expect(fetched?.mimeType).toBe("image/png");
    expect(fetched?.data.toString()).toBe("fake-png-bytes");

    // No shared profile with this user — no screenshot returned.
    expect(await getScreenshot(otherUserId, id)).toBeNull();
  });

  it("rejects an unsupported screenshot file type", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Bad Upload Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await expect(uploadScreenshot(userId, id, Buffer.from("not-an-image"), "text/plain")).rejects.toThrow(
      InvalidScreenshotError
    );
  });

  it("does not allow a user with no shared profile to read another user's resume", async () => {
    const id = await createResume(otherUserId, {
      jobLink: undefined,
      companyName: "Other Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    expect(await getResume(userId, id)).toBeNull();

    const stillThere = await getResume(otherUserId, id);
    expect(stillThere).not.toBeNull();
  });

  describe("shared-profile tracker (several accounts assigned to the same profile)", () => {
    it("lets a teammate on the same profile see, upload proof for, and get duplicate-blocked by another's entries", async () => {
      const profileId = await createProfile(MINIMAL_PERSONAL_INFO);
      const { id: teammateAId } = await createTestUser();
      const { id: teammateBId } = await createTestUser();

      try {
        await assignProfileToUser(profileId, teammateAId);
        await assignProfileToUser(profileId, teammateBId);

        const id = await createResume(teammateAId, {
          jobLink: "https://example.com/jobs/shared",
          companyName: "Shared Profile Co",
          jobTitle: "Engineer",
          jobDescription: "A description that is definitely long enough to pass validation.",
        });

        // Teammate B (same profile, didn't create it) can still open it directly.
        const bView = await getResume(teammateBId, id);
        expect(bView).not.toBeNull();
        expect(bView?.appliedByEmail).not.toBeNull();

        // ...but B's Applications list shows only what B personally logged, not
        // teammate A's entry.
        const listForB = await listResumes(teammateBId);
        expect(listForB.some((r) => r.id === id)).toBe(false);
        const listForA = await listResumes(teammateAId);
        expect(listForA.some((r) => r.id === id)).toBe(true);

        // Teammate B can upload proof for an entry teammate A created.
        await uploadScreenshot(teammateBId, id, Buffer.from("teammate-b-upload"), "image/png");
        const shot = await getScreenshot(teammateAId, id);
        expect(shot?.data.toString()).toBe("teammate-b-upload");

        // Teammate B independently logging the exact same job is caught as a
        // duplicate against teammate A's entry, since they share a profile.
        await expect(
          createResume(teammateBId, {
            jobLink: "https://example.com/jobs/shared",
            companyName: "Shared Profile Co",
            jobTitle: "Engineer",
            jobDescription: "A description that is definitely long enough to pass validation.",
          })
        ).rejects.toThrow(DuplicateApplicationError);
      } finally {
        await deleteTestUser(teammateAId);
        await deleteTestUser(teammateBId);
        await db.profile.delete({ where: { id: profileId } });
      }
    });
  });
});
