import { db } from "@/lib/db";
import { seedTeamInterviewConfig } from "@/lib/interview/config";

export type TeamSummary = {
  id: string;
  name: string;
  active: boolean;
  memberCount: number;
  createdAt: Date;
};

export async function listTeams(): Promise<TeamSummary[]> {
  const teams = await db.team.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, createdAt: true, _count: { select: { memberships: true } } },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    active: t.active,
    memberCount: t._count.memberships,
    createdAt: t.createdAt,
  }));
}

/** Creates a team plus its default settings row (each team brings its own OpenAI key later). */
export async function createTeam(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Team name is required.");
  const team = await db.team.create({ data: { name: trimmed } });
  await db.teamSettings.create({ data: { teamId: team.id } });
  await seedTeamInterviewConfig(team.id);
  return team.id;
}

export async function renameTeam(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Team name is required.");
  await db.team.update({ where: { id }, data: { name: trimmed } });
}

export async function setTeamActive(id: string, active: boolean): Promise<void> {
  await db.team.update({ where: { id }, data: { active } });
}
