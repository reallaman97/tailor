import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson } from "@/lib/profile/crypto";
import { createResume, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { loadAssistContext, saveCoverLetter, addAnswer, deleteAnswer, getAssistData, AssistUnavailableError } from "./store";

describe("application assistant storage + access (integration)", () => {
  let profileId: string;
  let otherProfileId: string;
  let bidderId: string;
  let outsiderId: string;
  let resumeId: string;
  let untailoredId: string;
  const bidder = () => ({ id: bidderId, role: "BIDDER" });
  const outsider = () => ({ id: outsiderId, role: "BIDDER" });

  beforeAll(async () => {
    profileId = await createProfile({ ...MINIMAL_PERSONAL_INFO, fullName: "Jordan A Rivera", contactEmail: "jordan.private@example.com" });
    otherProfileId = await createProfile(MINIMAL_PERSONAL_INFO);
    ({ id: bidderId } = await createTestUser());
    ({ id: outsiderId } = await createTestUser());
    await assignProfileToUser(profileId, bidderId);
    await assignProfileToUser(otherProfileId, outsiderId);

    const entryId = await createWorkHistoryEntry(profileId, {
      company: "Northwind Analytics",
      jobTitle: "Sr. AI Engineer",
      location: undefined,
      workingStyle: undefined,
      workingType: undefined,
      startDate: "2020-08",
      endDate: undefined,
      achievements: ["Original bullet."],
    });

    const job = { jobLink: undefined, companyName: "ShelfSense", jobDescription: "Build forecasting systems at scale for retail." };
    resumeId = await createResume(bidderId, { ...job, jobTitle: "Senior ML Engineer" });
    // A different company — one application per company per candidate is enforced.
    untailoredId = await createResume(bidderId, {
      ...job,
      companyName: "Globex",
      jobTitle: "Staff ML Engineer",
      jobDescription: "Design ranking systems for a marketplace search team, owning offline evaluation.",
    });

    // What tailorResume() would have stored: a realigned title and new bullets.
    const dek = await getProfileDek(profileId);
    await db.resume.update({
      where: { id: resumeId },
      data: {
        profileId,
        tailoredContentEnc: encryptJson(dek, {
          headline: "Senior Machine Learning Engineer",
          summary: "Builds forecasting systems.",
          workHistory: [{ entryId, jobTitle: "Senior Machine Learning Engineer", bullets: ["Built Kafka pipelines."] }],
        }),
      },
    });
  });

  afterAll(async () => {
    await deleteTestUser(bidderId);
    await deleteTestUser(outsiderId);
    await db.profile.deleteMany({ where: { id: { in: [profileId, otherProfileId] } } });
  });

  it("builds context from the SUBMITTED resume — realigned title, tailored bullets, no contact email", async () => {
    const { ctx } = await loadAssistContext(bidder(), resumeId);
    expect(ctx.resumeText).toContain("Senior Machine Learning Engineer — Northwind Analytics");
    expect(ctx.resumeText).toContain("- Built Kafka pipelines.");
    expect(ctx.resumeText).not.toContain("Original bullet.");
    expect(ctx.resumeText).not.toContain("jordan.private@example.com");
    expect(ctx).toMatchObject({ companyName: "ShelfSense", jobTitle: "Senior ML Engineer" });
  });

  it("refuses a bidder outside the application's profile, and an application with no tailored resume", async () => {
    await expect(loadAssistContext(outsider(), resumeId)).rejects.toThrow(ResumeNotFoundError);
    await expect(loadAssistContext(bidder(), untailoredId)).rejects.toThrow(AssistUnavailableError);
  });

  it("lets a team admin use it on any application", async () => {
    await expect(loadAssistContext({ id: outsiderId, role: "TEAM_ADMIN" }, resumeId)).resolves.toBeTruthy();
  });

  it("stores the cover letter and answers encrypted, and reads them back", async () => {
    const loaded = await loadAssistContext(bidder(), resumeId);
    await saveCoverLetter(loaded, "Dear Hiring Manager,\n\nLetter body.\n\nBest regards,\nJordan A Rivera");
    const saved = await addAnswer(loaded, {
      question: "What are your salary expectations?",
      answer: "My range is [your salary range].",
      length: "brief",
      charLimit: 300,
      needsReview: true,
      reviewNote: "Add your range.",
      createdById: bidderId,
    });

    const raw = await db.applicationAnswer.findUniqueOrThrow({ where: { id: saved.id } });
    expect(raw.questionEnc).not.toContain("salary");
    expect(raw.answerEnc).not.toContain("range");

    const data = await getAssistData(resumeId, profileId);
    expect(data.coverLetter?.text).toContain("Letter body.");
    expect(data.answers).toEqual([expect.objectContaining({ id: saved.id, question: "What are your salary expectations?", needsReview: true, charLimit: 300 })]);
  });

  it("only lets someone with access delete an answer", async () => {
    const loaded = await loadAssistContext(bidder(), resumeId);
    const saved = await addAnswer(loaded, {
      question: "Why us?",
      answer: "Because.",
      length: "brief",
      charLimit: null,
      needsReview: false,
      reviewNote: "",
      createdById: bidderId,
    });
    await expect(deleteAnswer(outsider(), resumeId, saved.id)).rejects.toThrow(ResumeNotFoundError);
    expect(await db.applicationAnswer.count({ where: { id: saved.id } })).toBe(1);
    await deleteAnswer(bidder(), resumeId, saved.id);
    expect(await db.applicationAnswer.count({ where: { id: saved.id } })).toBe(0);
  });
});
