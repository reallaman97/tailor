import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock the session source and Next's redirect so we can drive the boundary
// directly. redirect() never returns in Next (it throws); our mock mirrors that
// by throwing a recognizable sentinel we can assert on.
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
const redirectMock = vi.fn((url: string) => {
  throw new RedirectError(url);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import {
  requireUser,
  requireSuperAdmin,
  requireResumePlatformAccess,
  requireInterviewAccess,
  requireInterviewManager,
} from "./require-user";
import type { UserRole } from "@/generated/prisma/client";

type SessionUser = { id: string; email: string; role: UserRole };

/** Make auth() report the given session on the next call. */
function withSession(user: SessionUser | null): void {
  authMock.mockResolvedValue(user ? { user } : null);
}

async function setDbRole(userId: string, role: UserRole): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { role } });
}

describe("require-user authorization boundary (integration)", () => {
  let userId: string;
  let email: string;

  beforeAll(async () => {
    ({ id: userId, email } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  beforeEach(() => {
    redirectMock.mockClear();
  });

  describe("requireUser (session only)", () => {
    it("redirects to /login when there is no session", async () => {
      withSession(null);
      await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("redirects to /login when the session has no user id", async () => {
      authMock.mockResolvedValue({ user: { email } });
      await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("returns the session identity when present", async () => {
      withSession({ id: userId, email, role: "BIDDER" });
      await expect(requireUser()).resolves.toEqual({ id: userId, email, role: "BIDDER" });
    });
  });

  describe("requireSuperAdmin (re-checks the database, not the JWT)", () => {
    it("returns for a user whose DATABASE role is SUPERADMIN", async () => {
      await setDbRole(userId, "SUPERADMIN");
      withSession({ id: userId, email, role: "SUPERADMIN" });
      await expect(requireSuperAdmin()).resolves.toEqual({ id: userId, email });
    });

    it("redirects a non-superadmin to /", async () => {
      await setDbRole(userId, "BIDDER");
      withSession({ id: userId, email, role: "BIDDER" });
      await expect(requireSuperAdmin()).rejects.toThrow("REDIRECT:/");
    });

    it("trusts the fresh DB role over a stale SUPERADMIN JWT claim", async () => {
      // The session still claims SUPERADMIN, but the database says otherwise
      // (e.g. a demotion that hasn't expired from the JWT yet) — must redirect.
      await setDbRole(userId, "BIDDER");
      withSession({ id: userId, email, role: "SUPERADMIN" });
      await expect(requireSuperAdmin()).rejects.toThrow("REDIRECT:/");
    });
  });

  describe("requireResumePlatformAccess (tool allowlist, fresh DB role)", () => {
    it("grants a BIDDER access", async () => {
      await setDbRole(userId, "BIDDER");
      withSession({ id: userId, email, role: "BIDDER" });
      await expect(requireResumePlatformAccess()).resolves.toEqual({
        id: userId,
        email,
        role: "BIDDER",
      });
    });

    it("redirects a CALLER (not on the resume-platform allowlist) to /", async () => {
      await setDbRole(userId, "CALLER");
      withSession({ id: userId, email, role: "CALLER" });
      await expect(requireResumePlatformAccess()).rejects.toThrow("REDIRECT:/");
    });

    it("trusts the fresh DB role over a stale BIDDER JWT claim", async () => {
      await setDbRole(userId, "CALLER");
      withSession({ id: userId, email, role: "BIDDER" });
      await expect(requireResumePlatformAccess()).rejects.toThrow("REDIRECT:/");
    });
  });

  describe("requireInterviewAccess (DB-checked)", () => {
    it("grants a MANAGER access", async () => {
      await setDbRole(userId, "MANAGER");
      withSession({ id: userId, email, role: "MANAGER" });
      await expect(requireInterviewAccess()).resolves.toEqual({ id: userId, email, role: "MANAGER" });
    });

    it("grants a CALLER access", async () => {
      await setDbRole(userId, "CALLER");
      withSession({ id: userId, email, role: "CALLER" });
      await expect(requireInterviewAccess()).resolves.toMatchObject({ role: "CALLER" });
    });

    it("redirects a BIDDER (not on the interview allowlist) to /", async () => {
      await setDbRole(userId, "BIDDER");
      withSession({ id: userId, email, role: "BIDDER" });
      await expect(requireInterviewAccess()).rejects.toThrow("REDIRECT:/");
    });
  });

  describe("requireInterviewManager (DB-checked)", () => {
    it("grants a MANAGER manager-level access", async () => {
      await setDbRole(userId, "MANAGER");
      withSession({ id: userId, email, role: "MANAGER" });
      await expect(requireInterviewManager()).resolves.toMatchObject({ role: "MANAGER" });
    });

    it("sends a CALLER back to the interview hub (has access, but not manager rights)", async () => {
      await setDbRole(userId, "CALLER");
      withSession({ id: userId, email, role: "CALLER" });
      await expect(requireInterviewManager()).rejects.toThrow("REDIRECT:/interview");
    });
  });
});
