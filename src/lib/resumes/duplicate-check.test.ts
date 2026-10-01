import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { createResume, DuplicateApplicationError, findDuplicateApplication } from "./resumes";

const JD = Array.from(
  { length: 15 },
  (_, i) => `Own and scale streaming pipeline ${i} built with Kafka, Flink and Python on AWS, with on-call duty.`
).join(" ");

describe("duplicate checker (integration)", () => {
  let profileId: string;
  let otherProfileId: string;
  let bidderId: string;
  let teammateId: string;
  let otherBidderId: string;

  beforeAll(async () => {
    profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    otherProfileId = await createProfile(MINIMAL_PERSONAL_INFO);
    ({ id: bidderId } = await createTestUser());
    ({ id: teammateId } = await createTestUser());
    ({ id: otherBidderId } = await createTestUser());
    await assignProfileToUser(profileId, bidderId);
    await assignProfileToUser(profileId, teammateId); // shares the candidate
    await assignProfileToUser(otherProfileId, otherBidderId); // a different candidate

    await createResume(bidderId, {
      companyName: "Acme Robotics, Inc.",
      jobTitle: "Senior Data Engineer",
      jobLink: "https://www.linkedin.com/jobs/view/4011112222/?trackingId=abc",
      jobDescription: JD,
    });
  });

  afterAll(async () => {
    for (const id of [bidderId, teammateId, otherBidderId]) await deleteTestUser(id);
    await db.profile.deleteMany({ where: { id: { in: [profileId, otherProfileId] } } });
  });

  it("blocks a second position at the same company for the same candidate — even from a teammate's account", async () => {
    const attempt = createResume(teammateId, {
      companyName: "ACME ROBOTICS LLC",
      jobTitle: "Staff Platform Engineer",
      jobDescription: "A completely different role description that is long enough to pass validation here.",
    });
    await expect(attempt).rejects.toThrow(DuplicateApplicationError);
    await expect(attempt).rejects.toMatchObject({ reason: "company" });
  });

  it("blocks the same posting reached through a different URL, even under another company name", async () => {
    const hit = await findDuplicateApplication({ profileId }, {
      companyName: "Confidential",
      jobLink: "https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4011112222",
    });
    expect(hit?.reason).toBe("posting");
  });

  it("blocks a recruiter repost of the same description under a different company", async () => {
    const hit = await findDuplicateApplication({ profileId }, {
      companyName: "TalentBridge Staffing",
      jobDescription: `Our client is hiring! ${JD} Contact us today.`,
    });
    expect(hit?.reason).toBe("description");
    expect(hit?.existing.companyName).toBe("Acme Robotics, Inc.");
  });

  it("lets a different candidate apply to the same company", async () => {
    await expect(
      findDuplicateApplication({ profileId: otherProfileId }, { companyName: "Acme Robotics", jobDescription: JD })
    ).resolves.toBeNull();
  });

  it("lets the same candidate apply to an unrelated job at another company", async () => {
    await expect(
      findDuplicateApplication({ profileId }, {
        companyName: "Globex",
        jobLink: "https://boards.greenhouse.io/globex/jobs/777",
        jobDescription: "Design React and TypeScript interfaces for a design-system team, partnering with product designers daily on accessibility.",
      })
    ).resolves.toBeNull();
  });
});
