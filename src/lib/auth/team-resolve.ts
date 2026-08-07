import { db } from "@/lib/db";
import { isServiceAdmin as isServiceAdminRole } from "@/lib/auth/roles";
import type { UserRole } from "@/generated/prisma/client";

/**
 * Node-only (DB-backed) resolution of the teams a user may act in, plus their
 * global role. Shared by the JWT sign-in callback (src/auth.ts) and the
 * request-time team context (team-context.ts) so both agree on the team list,
 * ordering, and per-team role. NEVER call this on the edge (it touches Prisma).
 */

export type ResolvedTeam = { id: string; name: string; role: UserRole };

export type ResolvedTeams = {
  isServiceAdmin: boolean;
  globalRole: UserRole;
  teams: ResolvedTeam[];
};

export async function resolveUserTeams(userId: string): Promise<ResolvedTeams> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { isServiceAdmin: false, globalRole: "BIDDER", teams: [] };

  const serviceAdmin = isServiceAdminRole(user.role);

  let teams: ResolvedTeam[];
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

  return { isServiceAdmin: serviceAdmin, globalRole: user.role, teams };
}

/**
 * The role used for ACCESS gating (baked into the JWT and read by the edge
 * middleware). A service admin ALWAYS resolves to SERVICE_ADMIN — they keep
 * platform power (e.g. /platform) no matter which team they're acting in.
 * Everyone else takes the active team's role, falling back to their global role
 * when they have no team (an edge case).
 */
export function effectiveAccessRole(opts: {
  isServiceAdmin: boolean;
  globalRole: UserRole;
  activeRole: UserRole | null;
}): UserRole {
  if (opts.isServiceAdmin) return "SERVICE_ADMIN";
  return opts.activeRole ?? opts.globalRole;
}

/** Picks the active team from a resolved list given a preferred id (default: first). */
export function pickActiveTeam(teams: ResolvedTeam[], preferredId: string | null): ResolvedTeam | null {
  return teams.find((t) => t.id === preferredId) ?? teams[0] ?? null;
}
