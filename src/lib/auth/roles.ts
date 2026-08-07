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

/**
 * The roles an admin can assign, most-privileged first. SERVICE_ADMIN (platform
 * owner) is only offered to a service admin; team admins choose from
 * {@link TEAM_ROLE_OPTIONS}. The legacy SUPERADMIN is intentionally omitted —
 * it maps to TEAM_ADMIN and is no longer assignable.
 */
export const SERVICE_ROLE_OPTION = { value: "SERVICE_ADMIN", label: "Service Admin" } as const;

export const TEAM_ROLE_OPTIONS = [
  { value: "TEAM_ADMIN", label: "Team Admin" },
  { value: "MANAGER", label: "Manager" },
  { value: "CALLER", label: "Caller" },
  { value: "BIDDER", label: "Bidder" },
] as const;

/** Assignable roles for a given caller (service admins can also grant SERVICE_ADMIN). */
export function assignableRoleOptions(callerIsServiceAdmin: boolean) {
  return callerIsServiceAdmin ? [SERVICE_ROLE_OPTION, ...TEAM_ROLE_OPTIONS] : TEAM_ROLE_OPTIONS;
}

/** Every role that can appear (for labels/filters), newest model first. */
export const ALL_ROLE_LABELS: Record<string, string> = {
  SERVICE_ADMIN: "Service Admin",
  TEAM_ADMIN: "Team Admin",
  MANAGER: "Manager",
  CALLER: "Caller",
  BIDDER: "Bidder",
  SUPERADMIN: "Superadmin (legacy)",
};
