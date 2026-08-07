"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import { getTeamContext } from "@/lib/auth/team-context";

export type SwitcherData = {
  show: boolean; // hide entirely when there's nothing to switch
  activeTeamId: string | null;
  teams: { id: string; name: string }[];
};

/** Data for the team switcher island (called client-side on mount). */
export async function loadTeamSwitcher(): Promise<SwitcherData> {
  const ctx = await getTeamContext();
  if (!ctx) return { show: false, activeTeamId: null, teams: [] };
  return {
    // Worth showing if the user can switch (more than one) or is the platform
    // admin (who manages/enters teams).
    show: ctx.teams.length > 1 || ctx.isServiceAdmin,
    activeTeamId: ctx.activeTeamId,
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
