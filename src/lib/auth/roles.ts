/**
 * Role predicates for the multi-tenant model.
 *
 * "Team-admin power" is what today's SUPERADMIN had. During the migration three
 * roles carry it: the legacy SUPERADMIN, the new per-team TEAM_ADMIN, and the
 * platform SERVICE_ADMIN (who can act inside any team). Centralizing the check
 * here lets the ~20 gate sites stay correct as roles are renamed.
 *
 * Accepts a plain string so it works with both the Prisma `UserRole` enum and
 * the (identical) next-auth session role union.
 */
export function hasTeamAdminPower(role: string | null | undefined): boolean {
  return role === "SUPERADMIN" || role === "TEAM_ADMIN" || role === "SERVICE_ADMIN";
}

/** The platform owner ("Service Real Admin") — manages teams, no single team. */
export function isServiceAdmin(role: string | null | undefined): boolean {
  return role === "SERVICE_ADMIN";
}
