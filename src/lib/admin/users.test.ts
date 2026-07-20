import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import {
  listAllUsers,
  updateUserRole,
  CannotDemoteSelfError,
  deleteUserAsAdmin,
  CannotDeleteSelfError,
  updateUserApproval,
  CannotUnapproveSelfError,
} from "./users";

describe("admin users (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("lists a user with their default role and no assigned profile", async () => {
    const users = await listAllUsers();
    const found = users.find((u) => u.id === userId);
    expect(found).toBeDefined();
    expect(found?.role).toBe("USER");
    expect(found?.assignedProfileId).toBeNull();
  });

  it("reflects the assigned profile once one is assigned", async () => {
    const profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    try {
      await assignProfileToUser(profileId, userId);
      const users = await listAllUsers();
      const found = users.find((u) => u.id === userId);
      expect(found?.assignedProfileId).toBe(profileId);
      expect(found?.assignedProfileName).toBe(MINIMAL_PERSONAL_INFO.fullName);
    } finally {
      await db.profile.delete({ where: { id: profileId } });
    }
  });

  it("promotes and demotes a user's role", async () => {
    await updateUserRole("someone-else", userId, "SUPERADMIN");
    expect((await listAllUsers()).find((u) => u.id === userId)?.role).toBe("SUPERADMIN");

    await updateUserRole("someone-else", userId, "USER");
    expect((await listAllUsers()).find((u) => u.id === userId)?.role).toBe("USER");
  });

  it("refuses to let a superadmin demote themselves", async () => {
    await updateUserRole("someone-else", userId, "SUPERADMIN");
    await expect(updateUserRole(userId, userId, "USER")).rejects.toThrow(CannotDemoteSelfError);
    // Role is unchanged after the rejected self-demotion.
    expect((await listAllUsers()).find((u) => u.id === userId)?.role).toBe("SUPERADMIN");
  });

  it("refuses to let an admin delete their own account", async () => {
    await expect(deleteUserAsAdmin(userId, userId)).rejects.toThrow(CannotDeleteSelfError);
    // Account still exists after the rejected self-deletion.
    expect(await db.user.findUnique({ where: { id: userId } })).not.toBeNull();
  });

  it("lets an admin delete a different user's account, leaving their profile untouched", async () => {
    const { id: victimId } = await createTestUser();
    const profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    await assignProfileToUser(profileId, victimId);

    try {
      await deleteUserAsAdmin(userId, victimId);

      expect(await db.user.findUnique({ where: { id: victimId } })).toBeNull();
      expect(await db.profile.findUnique({ where: { id: profileId } })).not.toBeNull();
    } finally {
      await db.profile.delete({ where: { id: profileId } });
    }
  });

  it("new accounts default to unapproved", async () => {
    const user = await db.user.create({
      data: {
        email: `test-default-${Date.now()}@example.com`,
        passwordHash: "irrelevant",
        encryptedDek: "irrelevant",
      },
    });
    try {
      expect(user.approved).toBe(false);
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it("approves and un-approves a user", async () => {
    await updateUserApproval("someone-else", userId, false);
    expect((await listAllUsers()).find((u) => u.id === userId)?.approved).toBe(false);

    await updateUserApproval("someone-else", userId, true);
    expect((await listAllUsers()).find((u) => u.id === userId)?.approved).toBe(true);
  });

  it("refuses to let a superadmin revoke their own approval", async () => {
    await expect(updateUserApproval(userId, userId, false)).rejects.toThrow(CannotUnapproveSelfError);
    // Still approved after the rejected self-revocation.
    expect((await listAllUsers()).find((u) => u.id === userId)?.approved).toBe(true);
  });

  it("allows the same profile to be assigned to more than one account at once", async () => {
    const { id: otherUserId } = await createTestUser();
    const profileId = await createProfile(MINIMAL_PERSONAL_INFO);

    try {
      await assignProfileToUser(profileId, userId);
      await assignProfileToUser(profileId, otherUserId);

      const users = await listAllUsers();
      expect(users.find((u) => u.id === userId)?.assignedProfileId).toBe(profileId);
      expect(users.find((u) => u.id === otherUserId)?.assignedProfileId).toBe(profileId);
    } finally {
      await db.profile.delete({ where: { id: profileId } });
      await deleteTestUser(otherUserId);
    }
  });
});
