"use client";

import { useActionState, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { createTeamAction, renameTeamAction, setTeamActiveAction } from "./actions";

type Team = { id: string; name: string; active: boolean; memberCount: number };

export function TeamsView({ teams }: { teams: Team[] }) {
  const [state, formAction, creating] = useActionState(createTeamAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create a team</CardTitle>
          <CardDescription>Each team is an isolated tenant with its own members, data, and settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="name">
                Team name
              </label>
              <Input id="name" name="name" required placeholder="Acme Recruiting" className="w-64" />
            </div>
            <Button type="submit" loading={creating}>
              Create team
            </Button>
          </form>
          {state?.ok && <Alert variant="success" className="mt-3">{state.ok}</Alert>}
          {state?.error && <Alert variant="destructive" className="mt-3">{state.error}</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>{teams.length} team{teams.length === 1 ? "" : "s"}.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Name</th>
                <th className="p-3 font-medium text-muted-foreground">Members</th>
                <th className="p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <TeamRow key={team.id} team={team} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamRow({ team }: { team: Team }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3 font-medium text-foreground">
        {editing ? (
          <span className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-56" />
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  await renameTeamAction(team.id, name);
                  setEditing(false);
                })
              }
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setName(team.name); setEditing(false); }}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {team.name}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Rename
            </button>
          </span>
        )}
      </td>
      <td className="p-3 tabular-nums text-muted-foreground">{team.memberCount}</td>
      <td className="p-3">
        {team.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
      </td>
      <td className="p-3 text-right">
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() => startTransition(() => setTeamActiveAction(team.id, !team.active))}
        >
          {team.active ? "Deactivate" : "Activate"}
        </Button>
      </td>
    </tr>
  );
}
