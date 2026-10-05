import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { createResume, findDuplicateApplication, ResumeNotFoundError } from "./resumes";
import { cancelApplication, buildApplication, ApplicationCancelError } from "./build";

const JD = Array.from(
  { length: 12 },
  (_, i) => `Design ${i} resilient payment APIs in Go and PostgreSQL, owning reliability and on-call for the platform.`
).join(" ");

describe("canceling an application (integration)", () => {
  let profileId: string;
  let otherProfileId: string;
  let bidderId: string;
  let outsiderId: string;

  beforeAll(async () => {
    profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    otherProfileId = await createProfile(MINIMAL_PERSONAL_INFO);
    ({ id: bidderId } = await createTestUser());
    ({ id: outsiderId } = await createTestUser());
    await assignProfileToUser(profileId, bidderId);
    await assignProfileToUser(otherProfileId, outsiderId);
  }, 60_000);

  afterAll(async () => {
    for (const id of [bidderId, outsiderId]) await deleteTestUser(id);
    await db.profile.deleteMany({ where: { id: { in: [profileId, otherProfileId] } } });
  }, 60_000);

  const bidder = () => ({ id: bidderId, role: "BIDDER" });

  it("marks it Canceled, keeps it, and frees the company for a new application", async () => {
    const id = await createResume(bidderId, { companyName: "Ledgerline Payments", jobTitle: "Backend Engineer", jobDescription: JD });
    expect(await findDuplicateApplication({ profileId }, { companyName: "Ledgerline Payments" })).not.toBeNull();

    await cancelApplication(bidder(), id);

    const row = await db.resume.findUniqueOrThrow({ where: { id }, select: { statuses: true } });
    expect(row.statuses).toEqual(["CANCELED"]);
    // Neither the company nor the (identical) description blocks a fresh try.
    expect(await findDuplicateApplication({ profileId }, { companyName: "LEDGERLINE PAYMENTS INC", jobDescription: JD })).toBeNull();
  });

  it("won't let a bidder cancel once proof is uploaded — that application was submitted", async () => {
    const id = await createResume(bidderId, {
      companyName: "Northwind Freight",
      jobTitle: "Platform Engineer",
      jobDescription: "A distinct description for the freight platform role, long enough to be valid input.",
    });
    await db.resume.update({ where: { id }, data: { screenshotData: new Uint8Array([1, 2, 3]), screenshotMimeType: "image/webp" } });

    await expect(cancelApplication(bidder(), id)).rejects.toThrow(ApplicationCancelError);
    // An admin still can.
    await cancelApplication({ id: outsiderId, role: "TEAM_ADMIN" }, id);
    const row = await db.resume.findUniqueOrThrow({ where: { id }, select: { statuses: true } });
    expect(row.statuses).toEqual(["CANCELED"]);
  });

  it("won't let someone outside the candidate's profile cancel it", async () => {
    const id = await createResume(bidderId, {
      companyName: "Bluefin Analytics",
      jobTitle: "Data Engineer",
      jobDescription: "Another distinct description for an analytics role, long enough to be valid input.",
    });
    await expect(cancelApplication({ id: outsiderId, role: "BIDDER" }, id)).rejects.toThrow(ResumeNotFoundError);
  });

  it("a stopped build keeps the canceled application instead of rolling it back", async () => {
    const id = await createResume(bidderId, {
      companyName: "Quill Labs",
      jobTitle: "Software Engineer",
      jobDescription: "A distinct description for a software role at Quill Labs, long enough to be valid input.",
    });
    await cancelApplication(bidder(), id);

    const result = await buildApplication(bidder(), id, AbortSignal.abort());
    expect(result).toMatchObject({ ok: false, stopped: true });
    expect(await db.resume.findUnique({ where: { id }, select: { id: true } })).not.toBeNull();
  });
});
