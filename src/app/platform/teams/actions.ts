"use server";

import { revalidatePath } from "next/cache";
import { requireServiceAdmin } from "@/lib/auth/team-context";
import { createTeam, renameTeam, setTeamActive } from "@/lib/admin/teams";

export type TeamFormState = { ok?: string; error?: string } | undefined;

export async function createTeamAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  await requireServiceAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Team name is required." };
  try {
    await createTeam(name);
    revalidatePath("/platform/teams");
    return { ok: `Created team “${name}”.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't create the team." };
  }
}

export async function renameTeamAction(id: string, name: string): Promise<void> {
  await requireServiceAdmin();
  await renameTeam(id, name);
  revalidatePath("/platform/teams");
}

export async function setTeamActiveAction(id: string, active: boolean): Promise<void> {
  await requireServiceAdmin();
  await setTeamActive(id, active);
  revalidatePath("/platform/teams");
}
