import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { createTeam } from "@/lib/admin/teams";
import { listUnassignedSignups, claimSignupForTeam, rejectSignup, SignupNotAvailableError } from "./users";

describe("new sign-ups (integration)", () => {
  let teamId: string;
  let otherTeamId: string;
  let adminId: string;

  // Creating a team also seeds its interview settings — several round trips on a slow link.
  beforeAll(async () => {
    teamId = await createTeam(`Signups team ${randomUUID().slice(0, 8)}`);
    otherTeamId = await createTeam(`Other team ${randomUUID().slice(0, 8)}`);
    ({ id: adminId } = await createTestUser());
  }, 60_000);

  afterAll(async () => {
    if (adminId) await deleteTestUser(adminId);
    await db.team.deleteMany({ where: { id: { in: [teamId, otherTeamId].filter(Boolean) } } });
  }, 60_000);

  /** A fresh, unapproved account in no team — what self-service sign-up creates. */
  async function signUp() {
    const { id } = await createTestUser();
    await db.user.update({ where: { id }, data: { approved: false } });
    return id;
  }

  it("lists accounts that are in no team", async () => {
    const id = await signUp();
    try {
      const signups = await listUnassignedSignups();
      expect(signups.find((s) => s.id === id)).toMatchObject({ approved: false });
    } finally {
      await deleteTestUser(id);
    }
  });

  it("approving adds the account to the team with the chosen role, and it leaves the sign-up list", async () => {
    const id = await signUp();
    try {
      await claimSignupForTeam(adminId, id, teamId, "MANAGER");

      const user = await db.user.findUniqueOrThrow({
        where: { id },
        select: { approved: true, role: true, memberships: { select: { teamId: true, role: true } } },
      });
      expect(user.approved).toBe(true);
      expect(user.memberships).toEqual([{ teamId, role: "MANAGER" }]);
      expect((await listUnassignedSignups()).some((s) => s.id === id)).toBe(false);
    } finally {
      await deleteTestUser(id);
    }
  });

  it("won't let a team claim or reject someone who's already in another team", async () => {
    const id = await signUp();
    try {
      await claimSignupForTeam(adminId, id, otherTeamId, "BIDDER");
      await expect(claimSignupForTeam(adminId, id, teamId, "BIDDER")).rejects.toThrow(SignupNotAvailableError);
      await expect(rejectSignup(adminId, id)).rejects.toThrow(SignupNotAvailableError);
      // Still a member of the other team only, and still exists.
      const memberships = await db.teamMembership.findMany({ where: { userId: id }, select: { teamId: true } });
      expect(memberships).toEqual([{ teamId: otherTeamId }]);
    } finally {
      await deleteTestUser(id);
    }
  });

  it("rejecting deletes the account", async () => {
    const id = await signUp();
    await rejectSignup(adminId, id);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
  });
});
