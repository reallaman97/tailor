import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TOOLS, canAccessTool } from "@/lib/tools";
import { hasTeamAdminPower } from "@/lib/auth/roles";

export type Role = "SUPERADMIN" | "BIDDER" | "CALLER" | "MANAGER" | "SERVICE_ADMIN" | "TEAM_ADMIN";

/**
 * The real auth boundary. Call this at the top of every server action, route
 * handler, and page that touches user data — proxy.ts only redirects page
 * navigations and does not cover Server Actions.
 *
 * `role` here comes from the session/JWT — fine for cheap UI decisions (e.g.
 * showing the admin nav link), but never for gating an admin action. Use
 * requireSuperAdmin() or requireResumePlatformAccess() for that, which
 * re-check the database.
 */
export async function requireUser(): Promise<{ id: string; email: string; role: Role }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

/**
 * The real authorization boundary for admin-only pages and actions. Always
 * re-reads the role from the database rather than trusting the session/JWT
 * claim — a role change (e.g. a demotion) takes effect immediately here,
 * rather than waiting for the affected session to expire or re-authenticate.
 *
 * The UI never shows admin controls to non-admins, so hitting this check
 * should be rare in practice — redirecting (rather than a typed error) is
 * a fine, simple default for both pages and actions.
 */
export async function requireSuperAdmin(): Promise<{ id: string; email: string }> {
  const user = await requireUser();
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });
  if (!hasTeamAdminPower(fresh.role)) {
    redirect("/");
  }
  return { id: user.id, email: user.email };
}

/**
 * The authorization boundary for every Resume Platform page/action — not
 * every role can use this tool (e.g. a Caller cannot), so this re-checks the
 * role fresh from the database, same reasoning as requireSuperAdmin(), and
 * sends anyone without access back to the platform hub to pick a tool they
 * actually have.
 */
export async function requireResumePlatformAccess(): Promise<{ id: string; email: string; role: Role }> {
  const user = await requireUser();
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });

  const resumePlatform = TOOLS.find((tool) => tool.key === "resume-platform")!;
  if (!canAccessTool(fresh.role, resumePlatform)) {
    redirect("/");
  }

  return { id: user.id, email: user.email, role: fresh.role };
}

/**
 * The authorization boundary for every Interview Management page/action. Mirrors
 * requireResumePlatformAccess(): re-reads the role fresh from the database and
 * bounces anyone not on the tool's allowlist (Manager/Caller, plus Superadmin)
 * back to the hub. The returned `role` is what callers use to decide scope
 * (a Caller only ever sees their own assigned interviews) — see
 * src/lib/interview/interviews.ts.
 */
export async function requireInterviewAccess(): Promise<{ id: string; email: string; role: Role }> {
  const user = await requireUser();
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });

  const interviewTool = TOOLS.find((tool) => tool.key === "interview-management")!;
  if (!canAccessTool(fresh.role, interviewTool)) {
    redirect("/");
  }

  return { id: user.id, email: user.email, role: fresh.role };
}

/**
 * The stricter Interview Management boundary for manager-only work: create /
 * edit / delete an interview, assign a caller, and configure settings. A Caller
 * has interview access but not this — they can only comment on and re-status
 * interviews already assigned to them. Superadmin always qualifies.
 */
export async function requireInterviewManager(): Promise<{ id: string; email: string; role: Role }> {
  const access = await requireInterviewAccess();
  if (!hasTeamAdminPower(access.role) && access.role !== "MANAGER") {
    redirect("/interview");
  }
  return access;
}
