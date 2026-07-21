import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, createTestProfile, deleteTestProfile, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { getDashboardAnalytics } from "@/lib/resumes/analytics";
import type { ResumeStatus, RoleTrack, ApplicationSource } from "@/generated/prisma/client";

// getDashboardAnalytics() is a superadmin-only aggregate across every user in
// the (shared, ever-growing) dev DB, so every test here asserts a DELTA —
// snapshot before seeding, seed known data under a throwaway user, then
// assert the difference — rather than an absolute count.

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

async function seedResume(
  userId: string,
  overrides: Partial<{
    status: ResumeStatus;
    roleTrack: RoleTrack;
    source: ApplicationSource;
    updatedAt: Date;
    followUpDate: Date | null;
    profileId: string;
  }> = {}
) {
  const resume = await db.resume.create({
    data: {
      userId,
      profileId: overrides.profileId ?? null,
      companyName: "Seed Co",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
      statuses: [overrides.status ?? "APPLIED"],
      roleTrack: overrides.roleTrack ?? "OTHER",
      source: overrides.source ?? "OTHER",
      followUpDate: overrides.followUpDate ?? null,
    },
  });

  if (overrides.updatedAt) {
    await db.resume.update({ where: { id: resume.id }, data: { updatedAt: overrides.updatedAt } });
  }

  return resume.id;
}

describe("resume analytics (integration, aggregate across all users)", () => {
  it("computes overview totals across the positive/rejected/failed/ghosted categories", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).overview;

      await seedResume(userId, { status: "DRAFT" });
      await seedResume(userId, { status: "APPLIED" });
      await seedResume(userId, { status: "REPLY" });
      await seedResume(userId, { status: "OFFER" });
      await seedResume(userId, { status: "CANCELED" });
      await seedResume(userId, { status: "FAIL" });
      await seedResume(userId, { status: "GHOSTED" });

      const after = (await getDashboardAnalytics()).overview;
      expect(after.total - before.total).toBe(7);
      expect(after.awaitingResponse - before.awaitingResponse).toBe(2); // DRAFT + APPLIED
      expect(after.positiveResponses - before.positiveResponses).toBe(2); // REPLY + OFFER
      expect(after.rejected - before.rejected).toBe(1); // CANCELED
      expect(after.failed - before.failed).toBe(1); // FAIL
      expect(after.ghosted - before.ghosted).toBe(1); // GHOSTED
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("flags an open application as needing follow-up once it has gone quiet for 7+ days", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).overview.needsFollowUpToday;

      await seedResume(userId, { status: "APPLIED", updatedAt: daysAgo(10) });
      await seedResume(userId, { status: "APPLIED", updatedAt: daysAgo(1) });

      const after = (await getDashboardAnalytics()).overview.needsFollowUpToday;
      expect(after - before).toBe(1);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("flags an open application as needing follow-up when its explicit follow-up date has arrived", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).overview.needsFollowUpToday;

      await seedResume(userId, { status: "APPLIED", updatedAt: daysAgo(1), followUpDate: daysAgo(1) });

      const after = (await getDashboardAnalytics()).overview.needsFollowUpToday;
      expect(after - before).toBe(1);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("does not flag a closed-out application (e.g. GHOSTED) for follow-up even if stale", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).overview.needsFollowUpToday;

      await seedResume(userId, { status: "GHOSTED", updatedAt: daysAgo(30) });

      const after = (await getDashboardAnalytics()).overview.needsFollowUpToday;
      expect(after - before).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("buckets applications by profile, including a needs-follow-up count, and groups unassigned applications separately", async () => {
    const { id: userId } = await createTestUser();
    const profileId = await createTestProfile({ ...MINIMAL_PERSONAL_INFO, fullName: "Analytics Test Profile" });
    try {
      const beforeNoProfileTotal =
        (await getDashboardAnalytics()).byProfile.find((p) => p.profileId === null)?.total ?? 0;

      await seedResume(userId, { profileId, status: "APPLIED", updatedAt: daysAgo(10) }); // open + stale -> needs follow-up
      await seedResume(userId, { profileId, status: "OFFER" });
      await seedResume(userId, { profileId, status: "CANCELED" });
      await seedResume(userId, { status: "APPLIED" }); // no profile -> falls into the null bucket

      const after = await getDashboardAnalytics();
      const profileRow = after.byProfile.find((p) => p.profileId === profileId)!;
      expect(profileRow.profileName).toBe("Analytics Test Profile");
      expect(profileRow.total).toBe(3);
      expect(profileRow.awaitingResponse).toBe(1);
      expect(profileRow.positiveResponses).toBe(1);
      expect(profileRow.rejected).toBe(1);
      expect(profileRow.pending).toBe(1);
      expect(profileRow.needsFollowUp).toBe(1);
      expect(profileRow.positiveRate).toBeCloseTo((1 / 3) * 100);

      const afterNoProfileTotal = after.byProfile.find((p) => p.profileId === null)?.total ?? 0;
      expect(afterNoProfileTotal - beforeNoProfileTotal).toBe(1);
    } finally {
      await deleteTestUser(userId);
      await deleteTestProfile(profileId);
    }
  });

  it("scopes every section (overview, role track, source, today, weekly) to one profile when filtered", async () => {
    const { id: userId } = await createTestUser();
    const profileId = await createTestProfile();
    try {
      // A throwaway profile starts with nothing tracked, so a scoped call can
      // assert exact totals rather than a before/after delta.
      await seedResume(userId, { profileId, status: "APPLIED", roleTrack: "BACKEND", source: "RECRUITER" });
      await seedResume(userId, { profileId, status: "OFFER", roleTrack: "BACKEND", source: "RECRUITER", updatedAt: new Date() });
      // Unrelated data outside the scoped profile must not leak in.
      await seedResume(userId, { status: "REPLY", roleTrack: "FRONTEND", source: "JOB_BOARD" });

      const scoped = await getDashboardAnalytics({ profileId });
      expect(scoped.overview.total).toBe(2);
      expect(scoped.overview.awaitingResponse).toBe(1);
      expect(scoped.overview.positiveResponses).toBe(1);

      const backend = scoped.byRoleTrack.find((r) => r.roleTrack === "BACKEND")!;
      expect(backend.applied).toBe(2);
      const frontend = scoped.byRoleTrack.find((r) => r.roleTrack === "FRONTEND")!;
      expect(frontend.applied).toBe(0);

      const recruiter = scoped.bySource.find((s) => s.source === "RECRUITER")!;
      expect(recruiter.applied).toBe(2);
      const jobBoard = scoped.bySource.find((s) => s.source === "JOB_BOARD")!;
      expect(jobBoard.applied).toBe(0);

      expect(scoped.today.positiveResponses).toBe(1);
    } finally {
      await deleteTestUser(userId);
      await deleteTestProfile(profileId);
    }
  });

  it("buckets conversion by role track", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).byRoleTrack;
      const beforeBackend = before.find((r) => r.roleTrack === "BACKEND")!;
      const beforeFrontend = before.find((r) => r.roleTrack === "FRONTEND")!;

      await seedResume(userId, { roleTrack: "BACKEND", status: "APPLIED" });
      await seedResume(userId, { roleTrack: "BACKEND", status: "OFFER" });
      await seedResume(userId, { roleTrack: "BACKEND", status: "CANCELED" });
      await seedResume(userId, { roleTrack: "FRONTEND", status: "APPLIED" });

      const after = (await getDashboardAnalytics()).byRoleTrack;
      const backend = after.find((r) => r.roleTrack === "BACKEND")!;
      expect(backend.applied - beforeBackend.applied).toBe(3);
      expect(backend.positive - beforeBackend.positive).toBe(1);
      expect(backend.rejected - beforeBackend.rejected).toBe(1);
      expect(backend.pending - beforeBackend.pending).toBe(1);

      const frontend = after.find((r) => r.roleTrack === "FRONTEND")!;
      expect(frontend.applied - beforeFrontend.applied).toBe(1);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("buckets conversion by source", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).bySource;
      const beforeLinkedin = before.find((s) => s.source === "LINKEDIN_OUTREACH")!;
      const beforeRecruiter = before.find((s) => s.source === "RECRUITER")!;

      await seedResume(userId, { source: "LINKEDIN_OUTREACH", status: "REPLY" });
      await seedResume(userId, { source: "LINKEDIN_OUTREACH", status: "APPLIED" });
      await seedResume(userId, { source: "RECRUITER", status: "FAIL" });

      const after = (await getDashboardAnalytics()).bySource;
      const linkedin = after.find((s) => s.source === "LINKEDIN_OUTREACH")!;
      expect(linkedin.applied - beforeLinkedin.applied).toBe(2);
      expect(linkedin.positive - beforeLinkedin.positive).toBe(1);

      const recruiter = after.find((s) => s.source === "RECRUITER")!;
      expect(recruiter.applied - beforeRecruiter.applied).toBe(1);
      expect(recruiter.positive - beforeRecruiter.positive).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("classifies today's trend into positiveResponses/scheduled/rejected, excluding interview stages from positiveResponses", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).today;

      await seedResume(userId, { status: "REPLY", updatedAt: new Date() });
      await seedResume(userId, { status: "OFFER", updatedAt: new Date() });
      await seedResume(userId, { status: "INTRO", updatedAt: new Date() });
      await seedResume(userId, { status: "TECH2", updatedAt: new Date() });
      await seedResume(userId, { status: "CANCELED", updatedAt: new Date() });
      await seedResume(userId, { status: "APPLIED", updatedAt: new Date() }); // not classified at all

      const after = (await getDashboardAnalytics()).today;
      expect(after.positiveResponses - before.positiveResponses).toBe(2);
      expect(after.scheduled - before.scheduled).toBe(2);
      expect(after.rejected - before.rejected).toBe(1);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("does not count a stale (non-today) update toward today's trend", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).today.positiveResponses;

      await seedResume(userId, { status: "REPLY", updatedAt: daysAgo(3) });

      const after = (await getDashboardAnalytics()).today.positiveResponses;
      expect(after - before).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it("buckets a classified status into the correct week of the weekly trend", async () => {
    const { id: userId } = await createTestUser();
    try {
      const before = (await getDashboardAnalytics()).weekly;
      const beforeCurrentWeek = before[before.length - 1].positiveResponses;
      const beforeTotal = before.reduce((sum, w) => sum + w.positiveResponses, 0);

      await seedResume(userId, { status: "OFFER", updatedAt: new Date() });

      const after = (await getDashboardAnalytics()).weekly;
      expect(after).toHaveLength(6);
      const afterCurrentWeek = after[after.length - 1].positiveResponses;
      const afterTotal = after.reduce((sum, w) => sum + w.positiveResponses, 0);

      expect(afterCurrentWeek - beforeCurrentWeek).toBe(1);
      expect(afterTotal - beforeTotal).toBe(1);
    } finally {
      await deleteTestUser(userId);
    }
  });
});
