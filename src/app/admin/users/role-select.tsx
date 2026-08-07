"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "./actions";
import { Select } from "@/components/ui/select";
import { TEAM_ROLE_OPTIONS } from "@/lib/auth/roles";
import type { UserRole } from "@/generated/prisma/client";

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Service admins / legacy superadmins aren't team roles; show them as Team
  // Admin inline (they're managed properly on the edit page).
  const selectValue = TEAM_ROLE_OPTIONS.some((o) => o.value === role) ? role : "TEAM_ADMIN";

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={selectValue}
        disabled={pending || disabled}
        aria-label="User role"
        className="h-8 min-w-[9.5rem] text-sm"
        onChange={(e) => {
          const formData = new FormData();
          formData.set("role", e.target.value);
          startTransition(async () => {
            const result = await updateUserRoleAction(userId, undefined, formData);
            setError(result?.error ?? null);
          });
        }}
      >
        {TEAM_ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
