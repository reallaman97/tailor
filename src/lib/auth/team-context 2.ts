import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isServiceAdmin as isServiceAdminRole } from "@/lib/auth/roles";
import type { UserRole } from "@/generated/prisma/client";

/**
 * The multi-tenant request context: who the caller is, which team they're
 * currently acting in (the "active team"), and their role in it. A SERVICE_ADMIN
 * can act in ANY team (as TEAM_ADMIN); everyone else only in teams they belong
 * to. The active team is a cookie preference, defaulting to the first team.
 *
 * Phase 2b-i: this is the foundation. Query scoping (teamScope) is applied
 * feature-by-feature in 2b-ii.
 */

export const ACTIVE_TEAM_COOKIE = "cjp-active-team";

export type TeamOption = { id: string; name: string; role: UserRole };

export type TeamContext = {
  userId: string;
  email: string;
  isServiceAdmin: boolean;
  activeTeamId: string | null;
  teamRole: UserRole | null; // role in the active team (TEAM_ADMIN for a service admin)
  teams: TeamOption[]; // teams the user may act in / switch between
};

export async function getTeamContext(): Promise<TeamContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user) return null;
  const serviceAdmin = isServiceAdminRole(user.role);

  const preferred = (await cookies()).get(ACTIVE_TEAM_COOKIE)?.value ?? null;

  let teams: TeamOption[];
  if (serviceAdmin) {
    // A platform admin can act in any active team, with team-admin power.
    const all = await db.team.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    teams = all.map((t) => ({ id: t.id, name: t.name, role: "TEAM_ADMIN" as UserRole }));
  } else {
    const memberships = await db.teamMembership.findMany({
      where: { userId },
      select: { role: true, team: { select: { id: true, name: true, active: true } } },
    });
    teams = memberships
      .filter((m) => m.team.active)
      .map((m) => ({ id: m.team.id, name: m.team.name, role: m.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const active = teams.find((t) => t.id === preferred) ?? teams[0] ?? null;

  return {
    userId,
    email: user.email,
    isServiceAdmin: serviceAdmin,
    activeTeamId: active?.id ?? null,
    teamRole: active?.role ?? null,
    teams,
  };
}

export async function requireTeamContext(): Promise<TeamContext> {
  const ctx = await getTeamContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Platform owner only. */
export async function requireServiceAdmin(): Promise<TeamContext> {
  const ctx = await requireTeamContext();
  if (!ctx.isServiceAdmin) redirect("/");
  return ctx;
}

/** Team-admin power in the active team (a service admin qualifies in any team). `activeTeamId` is non-null on return. */
export async function requireTeamAdmin(): Promise<TeamContext> {
  const ctx = await requireTeamContext();
  if (!ctx.activeTeamId || !(ctx.isServiceAdmin || ctx.teamRole === "TEAM_ADMIN")) redirect("/");
  return ctx;
}

/**
 * The team filter for scoped queries. A service admin with an active team is
 * scoped to it (so "act inside a team" works); with no team selected they see
 * everything. Applied per-feature in Phase 2b-ii.
 */
export function teamScope(ctx: TeamContext): { teamId?: string } {
  return ctx.activeTeamId ? { teamId: ctx.activeTeamId } : {};
}
