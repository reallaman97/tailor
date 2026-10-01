"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { XIcon } from "@/components/icons";
import { TEAM_ROLE_OPTIONS } from "@/lib/auth/roles";
import { ProfileSelect } from "./profile-select";
import type { AdminUserSummary } from "@/lib/admin/users";
import {
  createTeamUserAction,
  setTeamUserRoleAction,
  setTeamApprovalAction,
  resetTeamPasswordAction,
  removeFromTeamAction,
  addSignupToTeamAction,
  rejectSignupAction,
} from "./team-console-actions";

type Profile = { id: string; fullName: string | null };

const ROLE_VALUES = new Set(TEAM_ROLE_OPTIONS.map((o) => o.value as string));
function normalizeRole(role: string): string {
  return ROLE_VALUES.has(role) ? role : "TEAM_ADMIN";
}

export type SignupRow = { id: string; email: string; username: string; approved: boolean; createdAt: string };

export function TeamUsersView({
  users,
  signups,
  profiles,
  currentUserId,
}: {
  users: AdminUserSummary[];
  signups: SignupRow[];
  profiles: Profile[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div className="flex flex-col gap-6">
      {signups.length > 0 && <SignupsCard signups={signups} />}
      <CreateUserCard />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Team members</CardTitle>
              <CardDescription>
                {users.length} member{users.length === 1 ? "" : "s"}. Change role or approval inline; changes save
                immediately.
              </CardDescription>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email or username…"
              className="h-9 w-64"
              aria-label="Search members"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-medium text-muted-foreground">Member</th>
                  <th className="p-3 font-medium text-muted-foreground">Role</th>
                  <th className="p-3 font-medium text-muted-foreground">Access</th>
                  <th className="p-3 font-medium text-muted-foreground">Profile</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Approved apps</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} profiles={profiles} isSelf={u.id === currentUserId} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No members match “{query}”.
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

/**
 * Accounts that signed up but aren't in any team yet. Approving adds them to
 * this team with the chosen role (they then appear under Team members, where a
 * profile can be assigned); rejecting deletes the account.
 */
function SignupsCard({ signups }: { signups: SignupRow[] }) {
  return (
    <Card className="border-warning/50">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>New sign-ups</CardTitle>
          <Badge variant="warning">{signups.length} waiting</Badge>
        </div>
        <CardDescription>
          People who signed up and aren&apos;t in a team yet. Approve to add them to this team with a role — they can
          log in right away — or reject to delete the account.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Account</th>
                <th className="p-3 font-medium text-muted-foreground">Signed up</th>
                <th className="p-3 font-medium text-muted-foreground">Role in this team</th>
                <th className="p-3 text-right font-medium text-muted-foreground">Decision</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((s) => (
                <SignupRowView key={s.id} signup={s} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SignupRowView({ signup }: { signup: SignupRow }) {
  const [role, setRole] = useState("BIDDER");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await addSignupToTeamAction(signup.id, role);
      if (res.error) setError(res.error);
    });
  }

  return (
    <tr className="border-b border-border align-middle last:border-0">
      <td className="p-3">
        <div className="font-medium text-foreground">{signup.username}</div>
        <div className="text-xs text-muted-foreground">{signup.email}</div>
        {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
      </td>
      <td className="p-3 text-muted-foreground">
        {new Date(signup.createdAt).toLocaleDateString()}
        {signup.approved && <div className="text-xs">Approved, but in no team</div>}
      </td>
      <td className="p-3">
        <Select
          value={role}
          disabled={pending}
          onChange={(e) => setRole(e.target.value)}
          className="h-8 min-w-[9.5rem] text-sm"
          aria-label={`Role for ${signup.email}`}
        >
          {TEAM_ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={approve} loading={pending}>
            Approve &amp; add to team
          </Button>
          <ConfirmDialog
            title="Reject this sign-up?"
            description={`This deletes the account for ${signup.email}. They can sign up again later if needed.`}
            confirmLabel="Reject"
            triggerVariant="ghost"
            triggerSize="sm"
            triggerLabel={`Reject ${signup.email}`}
            triggerContent="Reject"
            triggerClassName="text-destructive hover:bg-destructive/10"
            action={rejectSignupAction.bind(null, signup.id)}
          />
        </div>
      </td>
    </tr>
  );
}

function CreateUserCard() {
  const [state, formAction, pending] = useActionState(createTeamUserAction, undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a member</CardTitle>
        <CardDescription>Create an account in this team. They can log in once approved.</CardDescription>
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
            <Field label="Role">
              <Select name="role" defaultValue="BIDDER">
                {TEAM_ROLE_OPTIONS.map((o) => (
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
            Add member
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ user, profiles, isSelf }: { user: AdminUserSummary; profiles: Profile[]; isSelf: boolean }) {
  const [role, setRole] = useState(normalizeRole(user.role));
  const [approved, setApproved] = useState(user.approved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);

  function changeRole(next: string) {
    setRole(next);
    startTransition(async () => {
      const res = await setTeamUserRoleAction(user.id, next);
      setError(res.error ?? null);
    });
  }

  function toggleApproval() {
    startTransition(async () => {
      const res = await setTeamApprovalAction(user.id, !approved);
      if (res.error) setError(res.error);
      else {
        setApproved(!approved);
        setError(null);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-border align-middle last:border-0">
        <td className="p-3">
          <div className="font-medium text-foreground">{user.username}</div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
          {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </td>
        <td className="p-3">
          <Select
            value={role}
            disabled={pending || isSelf}
            onChange={(e) => changeRole(e.target.value)}
            className="h-8 min-w-[9.5rem] text-sm"
            aria-label={`Role for ${user.email}`}
          >
            {TEAM_ROLE_OPTIONS.map((o) => (
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
        <td className="p-3">
          <ProfileSelect userId={user.id} profileId={user.assignedProfileId} profiles={profiles} />
        </td>
        <td className="p-3 text-right tabular-nums text-muted-foreground">{user.approvedApplicationsCount}</td>
        <td className="p-3">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/admin/users/${user.id}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Edit
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setShowReset((s) => !s)}>
              Password
            </Button>
            {!isSelf && (
              <ConfirmDialog
                title="Remove from team?"
                description={`${user.email} will lose access to this team. Their account and applications are kept — a Service Admin can reassign them.`}
                confirmLabel="Remove"
                triggerVariant="ghost"
                triggerSize="icon"
                triggerLabel={`Remove ${user.email} from team`}
                triggerContent={<XIcon className="size-4 text-destructive" />}
                action={removeFromTeamAction.bind(null, user.id)}
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
  const action = resetTeamPasswordAction.bind(null, userId);
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
