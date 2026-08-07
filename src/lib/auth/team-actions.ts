"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTeamContext, ACTIVE_TEAM_COOKIE } from "@/lib/auth/team-context";

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
  if (!ctx.teams.some((t) => t.id === teamId)) return; // not allowed to act in this team

  (await cookies()).set(ACTIVE_TEAM_COOKIE, teamId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
}
