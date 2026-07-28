"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "./actions";
import { Select } from "@/components/ui/select";
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

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={role}
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
        <option value="BIDDER">Bidder</option>
        <option value="CALLER">Caller</option>
        <option value="MANAGER">Manager</option>
        <option value="SUPERADMIN">Superadmin</option>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
