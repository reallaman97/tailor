import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { createResume, getResume, uploadScreenshot } from "@/lib/resumes/resumes";
import {
  setApplicationApproval,
  getApplicationScreenshot,
  countApprovedApplications,
  setApplicationStatus,
  addStatusToApplications,
  setApplicationSource,
  updateApplicationDetails,
  getApplicationDetail,
  listAllApplications,
  deleteApplication,
  deleteApplications,
} from "./applications";

describe("admin applications (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("approves an application, sets approvedAt, and counts it toward the user's approved total", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Approve Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    await uploadScreenshot(userId, id, Buffer.from("fake-png"), "image/png");

    const before = await countApprovedApplications(userId);

    await setApplicationApproval(id, "APPROVED");

    const resume = await db.resume.findUniqueOrThrow({ where: { id } });
    expect(resume.approvalStatus).toBe("APPROVED");
    expect(resume.approvedAt).not.toBeNull();

    expect(await countApprovedApplications(userId)).toBe(before + 1);

    const approved = await listAllApplications({ approvalStatus: "APPROVED", userId });
    expect(approved.some((a) => a.id === id)).toBe(true);
  });

  it("rejects an application and clears approvedAt", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Reject Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    await uploadScreenshot(userId, id, Buffer.from("fake-png"), "image/png");

    await setApplicationApproval(id, "APPROVED");
    await setApplicationApproval(id, "REJECTED");

    const resume = await db.resume.findUniqueOrThrow({ where: { id } });
    expect(resume.approvalStatus).toBe("REJECTED");
    expect(resume.approvedAt).toBeNull();
  });

  it("serves a screenshot for any user's application, unscoped by owner", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Cross User Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    await uploadScreenshot(userId, id, Buffer.from("admin-visible-bytes"), "image/jpeg");

    const shot = await getApplicationScreenshot(id);
    expect(shot?.mimeType).toBe("image/jpeg");
    expect(shot?.data.toString()).toBe("admin-visible-bytes");
  });

  it("returns null when an application has no screenshot", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Empty Proof Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    expect(await getApplicationScreenshot(id)).toBeNull();
  });

  it("replaces an application's status set for any user, setting appliedAt exactly once on first entry of APPLIED", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Admin Status Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await setApplicationStatus(id, ["APPLIED"]);
    const afterApply = await getResume(userId, id);
    expect(afterApply?.statuses).toEqual(["APPLIED"]);
    const firstAppliedAt = afterApply?.appliedAt;
    expect(firstAppliedAt).not.toBeNull();

    await setApplicationStatus(id, ["APPLIED", "INTRO"]);
    const afterIntro = await getResume(userId, id);
    expect(afterIntro?.statuses).toEqual(["APPLIED", "INTRO"]);
    expect(afterIntro?.appliedAt).toEqual(firstAppliedAt);
  });

  it("bumps updatedAt when superadmin changes only the status", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Updated At Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    const before = await db.resume.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    await setApplicationStatus(id, ["APPLIED"]);

    const after = await db.resume.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("deletes multiple selected applications in bulk", async () => {
    const idA = await createResume(userId, {
      jobLink: undefined,
      companyName: "Bulk Delete Co A",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    const idB = await createResume(userId, {
      jobLink: undefined,
      companyName: "Bulk Delete Co B",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await deleteApplications([idA, idB]);

    expect(await getResume(userId, idA)).toBeNull();
    expect(await getResume(userId, idB)).toBeNull();
  });

  it("adds one status to each of multiple selected applications, without dropping their existing statuses", async () => {
    const idA = await createResume(userId, {
      jobLink: undefined,
      companyName: "Bulk Co A",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    const idB = await createResume(userId, {
      jobLink: undefined,
      companyName: "Bulk Co B",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
      status: "APPLIED",
    });

    await addStatusToApplications([idA, idB], "APPLIED");

    const resumeA = await db.resume.findUniqueOrThrow({ where: { id: idA } });
    const resumeB = await db.resume.findUniqueOrThrow({ where: { id: idB } });
    expect(resumeA.statuses).toEqual(["DRAFT", "APPLIED"]);
    expect(resumeA.appliedAt).not.toBeNull();
    // Already had APPLIED — adding it again must not duplicate it in the array.
    expect(resumeB.statuses).toEqual(["APPLIED"]);
  });

  it("changes only the source, leaving follow-up date and notes untouched", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Source Only Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });
    await updateApplicationDetails(id, {
      source: "JOB_BOARD",
      followUpDate: "2026-08-01",
      notes: "Keep this note.",
    });

    await setApplicationSource(id, "RECRUITER");

    const detail = await getResume(userId, id);
    expect(detail?.source).toBe("RECRUITER");
    expect(detail?.followUpDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(detail?.notes).toBe("Keep this note.");
  });

  it("updates source, follow-up date, and notes for any user's application", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Admin Details Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await updateApplicationDetails(id, {
      source: "LINKEDIN_OUTREACH",
      followUpDate: "2026-08-01",
      notes: "Recruiter mentioned a fast process.",
    });

    const detail = await getResume(userId, id);
    expect(detail?.source).toBe("LINKEDIN_OUTREACH");
    expect(detail?.followUpDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(detail?.notes).toBe("Recruiter mentioned a fast process.");
  });

  it("fetches one application by id regardless of owner, including the creator's email", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "Cross User Detail Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    const detail = await getApplicationDetail(id);
    expect(detail?.id).toBe(id);
    expect(detail?.userId).toBe(userId);
    expect(detail?.companyName).toBe("Cross User Detail Co");
    expect(detail?.appliedByEmail).not.toBeNull();
    expect(detail?.profileId).toBeNull();
    expect(detail?.profileName).toBeNull();
  });

  it("resolves profileId and profileName for an application created under an assigned profile", async () => {
    const profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    const { id: profileUserId } = await createTestUser();
    try {
      await assignProfileToUser(profileId, profileUserId);

      const id = await createResume(profileUserId, {
        jobLink: undefined,
        companyName: "Profile Detail Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      });

      const detail = await getApplicationDetail(id);
      expect(detail?.profileId).toBe(profileId);
      expect(detail?.profileName).toBe(MINIMAL_PERSONAL_INFO.fullName);

      const rows = await listAllApplications({ profileId });
      expect(rows.some((r) => r.id === id)).toBe(true);
      expect(rows.find((r) => r.id === id)?.profileName).toBe(MINIMAL_PERSONAL_INFO.fullName);
    } finally {
      await deleteTestUser(profileUserId);
      await db.profile.delete({ where: { id: profileId } });
    }
  });

  it("returns null from getApplicationDetail for a nonexistent id", async () => {
    expect(await getApplicationDetail("nonexistent-id")).toBeNull();
  });

  it("deletes any user's application — the only way to remove a record, since normal users cannot", async () => {
    const id = await createResume(userId, {
      jobLink: undefined,
      companyName: "ToDelete Inc",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await deleteApplication(id);
    expect(await getResume(userId, id)).toBeNull();
  });

  it("lists every user's applications, newest applied-date first, with profile/user filtering", async () => {
    const { id: otherUserId } = await createTestUser();
    try {
      const mine = await createResume(userId, {
        jobLink: undefined,
        companyName: "Tracker Co A",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
        status: "APPLIED",
      });
      const theirs = await createResume(otherUserId, {
        jobLink: undefined,
        companyName: "Tracker Co B",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
        status: "APPLIED",
      });

      const all = await listAllApplications();
      expect(all.some((a) => a.id === mine)).toBe(true);
      expect(all.some((a) => a.id === theirs)).toBe(true);

      const onlyMine = await listAllApplications({ userId });
      expect(onlyMine.some((a) => a.id === mine)).toBe(true);
      expect(onlyMine.some((a) => a.id === theirs)).toBe(false);
    } finally {
      await deleteTestUser(otherUserId);
    }
  });
});
