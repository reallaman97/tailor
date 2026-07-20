"use client";

import { useState, useTransition } from "react";
import { addUserToProfileAction, removeUserFromProfileAction } from "../actions";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@/components/icons";
import type { AdminUserSummary } from "@/lib/admin/users";

export function AssignedUsersManager({
  profileId,
  assignedUsers,
  allUsers,
}: {
  profileId: string;
  assignedUsers: Array<{ id: string; email: string }>;
  allUsers: AdminUserSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const assignedIds = new Set(assignedUsers.map((u) => u.id));
  const addableUsers = allUsers.filter((u) => !assignedIds.has(u.id));

  function addUser() {
    if (!selectedUserId) return;
    const formData = new FormData();
    formData.set("userId", selectedUserId);
    startTransition(async () => {
      try {
        await addUserToProfileAction(profileId, formData);
        setSelectedUserId("");
        setError(null);
      } catch {
        setError("Couldn't add that account");
      }
    });
  }

  function removeUser(userId: string) {
    startTransition(async () => {
      try {
        await removeUserFromProfileAction(profileId, userId);
        setError(null);
      } catch {
        setError("Couldn't remove that account");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {assignedUsers.length === 0 && (
        <p className="text-sm text-muted-foreground">No accounts assigned yet.</p>
      )}
      {assignedUsers.map((u) => (
        <div
          key={u.id}
          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <span className="text-sm text-foreground">{u.email}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => removeUser(u.id)}
          >
            <TrashIcon className="size-4" />
            Remove
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Select
          value={selectedUserId}
          disabled={pending}
          aria-label="Add account to this profile"
          className="h-9 min-w-[16rem] text-sm"
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          <option value="">Choose an account to add…</option>
          {addableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
              {u.assignedProfileId ? " (currently has a different profile)" : ""}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" disabled={pending || !selectedUserId} onClick={addUser}>
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
