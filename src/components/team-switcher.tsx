"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { loadTeamSwitcher, setActiveTeamAction, type SwitcherData } from "@/lib/auth/team-actions";

/**
 * Self-contained team switcher for the top bar. Loads its data from a server
 * action on mount (so the client shells don't need server props) and hides
 * itself unless there's something to switch. Changing the team refreshes the
 * page so every server-rendered, team-scoped view updates.
 */
export function TeamSwitcher() {
  const router = useRouter();
  const [data, setData] = useState<SwitcherData | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadTeamSwitcher()
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || !data.show || data.teams.length === 0) return null;

  return (
    <Select
      value={data.activeTeamId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const teamId = e.target.value;
        setData((d) => (d ? { ...d, activeTeamId: teamId } : d));
        startTransition(async () => {
          await setActiveTeamAction(teamId);
          router.refresh();
        });
      }}
      className="h-8 max-w-[11rem] text-xs"
      aria-label="Active team"
      title="Active team"
    >
      {data.teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
  );
}
