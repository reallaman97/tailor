import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createUserAsAdmin,
  getUserForAdmin,
  updateUserAsAdmin,
  adminSetPassword,
  DuplicateUserError,
} from "@/lib/admin/users";
import { getAdminStats } from "@/lib/admin/stats";

describe("admin user CRUD (integration)", () => {
  const createdIds: string[] = [];

  const uniqueInput = (over: Partial<{ email: string; username: string }> = {}) => {
    const s = randomUUID().replace(/-/g, "").slice(0, 16);
    return {
      email: over.email ?? `admincrud_${s}@example.com`,
      username: over.username ?? `admincrud_${s}`,
      password: "supersecret123",
      role: "CALLER" as const,
      approved: true,
    };
  };

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: createdIds } } });
  });

  it("creates a user with the chosen role and approval", async () => {
    const input = uniqueInput();
    const id = await createUserAsAdmin(input);
    createdIds.push(id);

    const user = await getUserForAdmin(id);
    expect(user).toMatchObject({ email: input.email, username: input.username, role: "CALLER", approved: true });
  });

  it("rejects a duplicate email and a duplicate username", async () => {
    const input = uniqueInput();
    const id = await createUserAsAdmin(input);
    createdIds.push(id);

    await expect(createUserAsAdmin(uniqueInput({ email: input.email }))).rejects.toBeInstanceOf(DuplicateUserError);
    await expect(createUserAsAdmin(uniqueInput({ username: input.username }))).rejects.toBeInstanceOf(
      DuplicateUserError
    );
  });

  it("edits identity fields and enforces uniqueness", async () => {
    const a = await createUserAsAdmin(uniqueInput());
    const b = await createUserAsAdmin(uniqueInput());
    createdIds.push(a, b);

    const newName = `renamed_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    await updateUserAsAdmin(a, { email: `renamed_${a}@example.com`, username: newName });
    expect((await getUserForAdmin(a))?.username).toBe(newName);

    // Collide b's username with a's → rejected.
    await expect(updateUserAsAdmin(b, { email: `x_${b}@example.com`, username: newName })).rejects.toBeInstanceOf(
      DuplicateUserError
    );
  });

  it("resets a password to a new working value", async () => {
    const id = await createUserAsAdmin(uniqueInput());
    createdIds.push(id);

    await adminSetPassword(id, "brand-new-password-9");
    const row = await db.user.findUniqueOrThrow({ where: { id }, select: { passwordHash: true } });
    expect(await verifyPassword(row.passwordHash, "brand-new-password-9")).toBe(true);
    expect(await verifyPassword(row.passwordHash, "supersecret123")).toBe(false);
  });

  it("reports aggregate stats", async () => {
    const id = await createUserAsAdmin(uniqueInput());
    createdIds.push(id);

    const stats = await getAdminStats();
    expect(stats.totalUsers).toBeGreaterThanOrEqual(1);
    expect(stats.usersByRole.CALLER).toBeGreaterThanOrEqual(1);
    expect(typeof stats.totalInterviews).toBe("number");
  });
});
