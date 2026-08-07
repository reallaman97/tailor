"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import { getTeamContext } from "@/lib/auth/team-context";

export type SwitcherData = {
  // True when the user has more than one team (or is the platform admin) and so
  // gets a dropdown; false when they belong to a single team and instead get a
  // static team-name badge in the header.
  canSwitch: boolean;
  activeTeamId: string | null;
  activeTeamName: string | null;
  teams: { id: string; name: string }[];
};

/** Data for the team switcher island (called client-side on mount). */
export async function loadTeamSwitcher(): Promise<SwitcherData> {
  const ctx = await getTeamContext();
  if (!ctx) return { canSwitch: false, activeTeamId: null, activeTeamName: null, teams: [] };
  const active = ctx.teams.find((t) => t.id === ctx.activeTeamId) ?? null;
  return {
    canSwitch: ctx.teams.length > 1 || ctx.isServiceAdmin,
    activeTeamId: ctx.activeTeamId,
    activeTeamName: active?.name ?? null,
    teams: ctx.teams.map((t) => ({ id: t.id, name: t.name })),
  };
}

/** Switches the caller's active team (validated against their allowed teams), then refreshes. */
export async function setActiveTeamAction(teamId: string): Promise<void> {
  const ctx = await getTeamContext();
  if (!ctx) return;
  const target = ctx.teams.find((t) => t.id === teamId);
  if (!target) return; // not allowed to act in this team

  // Bake the new team + gating role into the JWT (the source of truth). A
  // service admin keeps SERVICE_ADMIN power in any team; everyone else takes
  // the team's role, so the edge middleware gates per active team.
  const role = ctx.isServiceAdmin ? "SERVICE_ADMIN" : target.role;
  await unstable_update({ user: { activeTeamId: teamId, role } });
  revalidatePath("/");
}
