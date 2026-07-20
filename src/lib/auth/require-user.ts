import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type Role = "USER" | "SUPERADMIN";

/**
 * The real auth boundary. Call this at the top of every server action, route
 * handler, and page that touches user data — proxy.ts only redirects page
 * navigations and does not cover Server Actions.
 *
 * `role` here comes from the session/JWT — fine for cheap UI decisions (e.g.
 * showing the admin nav link), but never for gating an admin action. Use
 * requireSuperAdmin() for that, which re-checks the database directly.
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
  if (fresh.role !== "SUPERADMIN") {
    redirect("/resumes");
  }
  return { id: user.id, email: user.email };
}
