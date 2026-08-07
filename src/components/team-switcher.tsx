"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { UsersIcon } from "@/components/icons";
import { loadTeamSwitcher, setActiveTeamAction, type SwitcherData } from "@/lib/auth/team-actions";

/**
 * Self-contained team indicator for the top bar. Loads its data from a server
 * action on mount (so the client shells don't need server props). Users who can
 * switch teams (multi-team members and the platform admin) get a dropdown;
 * everyone else — e.g. a bidder in a single team — gets a static team-name
 * badge so they always see which team they're working in. Changing the team
 * refreshes the page so every server-rendered, team-scoped view updates.
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

  if (!data) return null;

  // Single-team members (bidders, etc.): show the team name, not a control.
  if (!data.canSwitch || data.teams.length <= 1) {
    if (!data.activeTeamName) return null;
    return (
      <div
        className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-2 pr-2.5 text-xs font-medium text-foreground"
        title={`Team: ${data.activeTeamName}`}
      >
        <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UsersIcon className="size-2.5" />
        </span>
        <span className="max-w-[11rem] truncate">{data.activeTeamName}</span>
      </div>
    );
  }

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
