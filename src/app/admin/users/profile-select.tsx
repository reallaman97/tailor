"use client";

import { useState, useTransition } from "react";
import { updateUserProfileAction } from "./actions";
import { Select } from "@/components/ui/select";

export function ProfileSelect({
  userId,
  profileId,
  profiles,
  disabled,
}: {
  userId: string;
  profileId: string | null;
  profiles: Array<{ id: string; fullName: string | null }>;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={profileId ?? ""}
        disabled={pending || disabled}
        aria-label="Assigned profile"
        className="h-8 min-w-[12rem] text-sm"
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            try {
              await updateUserProfileAction(userId, next);
              setError(null);
            } catch {
              setError("Couldn't update the assigned profile");
            }
          });
        }}
      >
        <option value="">Unassigned</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName ?? "Untitled profile"}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
