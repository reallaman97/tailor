"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrashIcon } from "@/components/icons";
import { assignableRoleOptions } from "@/lib/auth/roles";
import type { PlatformUserRow } from "@/lib/admin/users";
import {
  createPlatformUserAction,
  setUserTeamRoleAction,
  setApprovalAction,
  resetPasswordAction,
  deletePlatformUserAction,
} from "./actions";

type Team = { id: string; name: string };

const ROLE_OPTIONS = assignableRoleOptions(true); // service admin can grant any role
const ROLE_VALUES = new Set(ROLE_OPTIONS.map((o) => o.value as string));

/** Legacy/global roles that aren't in the option list map to Team Admin. */
function normalizeRole(role: string): string {
  return ROLE_VALUES.has(role) ? role : "TEAM_ADMIN";
}

export function PlatformUsersView({
  users,
  teams,
  currentUserId,
}: {
  users: PlatformUserRow[];
  teams: Team[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.teamName ?? "").toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div className="flex flex-col gap-6">
      <CreateUserCard teams={teams} />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>All users</CardTitle>
              <CardDescription>
                {users.length} user{users.length === 1 ? "" : "s"} across every team. Change team, role, or approval
                inline; changes save immediately.
              </CardDescription>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, username, team…"
              className="h-9 w-64"
              aria-label="Search users"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-medium text-muted-foreground">User</th>
                  <th className="p-3 font-medium text-muted-foreground">Team</th>
                  <th className="p-3 font-medium text-muted-foreground">Role</th>
                  <th className="p-3 font-medium text-muted-foreground">Access</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Approved apps</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} teams={teams} isSelf={u.id === currentUserId} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No users match “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserCard({ teams }: { teams: Team[] }) {
  const [state, formAction, pending] = useActionState(createPlatformUserAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a user</CardTitle>
        <CardDescription>Add an account to any team with any role. They can log in once approved.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Email">
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Username">
              <Input name="username" required autoComplete="off" />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" required autoComplete="new-password" />
            </Field>
            <Field label="Team">
              <Select name="teamId" defaultValue={teams[0]?.id ?? ""} required>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue="BIDDER">
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
              <input type="checkbox" name="approved" value="true" defaultChecked className="size-4 rounded border-input" />
              Approved (can log in)
            </label>
          </div>
          {state?.error && <Alert variant="destructive">{state.error}</Alert>}
          {state?.ok && <Alert variant="success">{state.ok}</Alert>}
          <Button type="submit" loading={pending} className="self-start">
            Create user
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, teams, isSelf }: { user: PlatformUserRow; teams: Team[]; isSelf: boolean }) {
  const [teamId, setTeamId] = useState(user.teamId ?? teams[0]?.id ?? "");
  const [role, setRole] = useState(normalizeRole(user.role));
  const [approved, setApproved] = useState(user.approved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);

  function saveTeamRole(nextTeam: string, nextRole: string) {
    startTransition(async () => {
      const res = await setUserTeamRoleAction(user.id, nextTeam, nextRole);
      setError(res.error ?? null);
    });
  }

  function toggleApproval() {
    startTransition(async () => {
      const res = await setApprovalAction(user.id, !approved);
      if (res.error) setError(res.error);
      else {
        setApproved(!approved);
        setError(null);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-border last:border-0 align-middle">
        <td className="p-3">
          <div className="font-medium text-foreground">{user.username}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </td>
        <td className="p-3">
          <Select
            value={teamId}
            disabled={pending}
            onChange={(e) => {
              setTeamId(e.target.value);
              saveTeamRole(e.target.value, role);
            }}
            className="h-8 min-w-[9rem] text-sm"
            aria-label={`Team for ${user.email}`}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </td>
        <td className="p-3">
          <Select
            value={role}
            disabled={pending || isSelf}
            onChange={(e) => {
              setRole(e.target.value);
              saveTeamRole(teamId, e.target.value);
            }}
            className="h-8 min-w-[9.5rem] text-sm"
            aria-label={`Role for ${user.email}`}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </td>
        <td className="p-3">
          <button
            type="button"
            onClick={toggleApproval}
            disabled={pending || isSelf}
            className="disabled:opacity-60"
            title={approved ? "Click to block sign-in" : "Click to approve sign-in"}
          >
            {approved ? <Badge variant="success">Approved</Badge> : <Badge variant="secondary">Pending</Badge>}
          </button>
        </td>
        <td className="p-3 text-right tabular-nums text-muted-foreground">{user.approvedApplicationsCount}</td>
        <td className="p-3">
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowReset((s) => !s)}>
              Password
            </Button>
            {!isSelf && (
              <ConfirmDialog
                title="Delete this user?"
                description={`This permanently deletes ${user.email}'s account and all generated resumes. This cannot be undone.`}
                confirmLabel="Delete user"
                triggerVariant="ghost"
                triggerSize="icon"
                triggerLabel={`Delete ${user.email}`}
                triggerContent={<TrashIcon className="size-4 text-destructive" />}
                action={deletePlatformUserAction.bind(null, user.id)}
              />
            )}
          </div>
        </td>
      </tr>
      {showReset && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={6} className="p-3">
            <ResetPasswordForm userId={user.id} email={user.email} onDone={() => setShowReset(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function ResetPasswordForm({ userId, email, onDone }: { userId: string; email: string; onDone: () => void }) {
  const action = resetPasswordAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">New password for {email}</label>
        <Input name="password" type="password" required autoComplete="new-password" className="h-8 w-64" />
      </div>
      <Button type="submit" size="sm" variant="secondary" loading={pending}>
        Set password
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {state?.error && <span className="text-xs text-destructive">{state.error}</span>}
      {state?.ok && <span className="text-xs text-success">{state.ok}</span>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
