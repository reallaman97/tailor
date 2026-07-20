"use client";

import { useState, useTransition } from "react";
import { updateUserApprovalAction } from "./actions";
import { Select } from "@/components/ui/select";

export function ApprovalSelect({
  userId,
  approved,
  disabled,
}: {
  userId: string;
  approved: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={approved ? "true" : "false"}
        disabled={pending || disabled}
        aria-label="Approval status"
        className="h-8 min-w-[8rem] text-sm"
        onChange={(e) => {
          const formData = new FormData();
          formData.set("approved", e.target.value);
          startTransition(async () => {
            const result = await updateUserApprovalAction(userId, undefined, formData);
            setError(result?.error ?? null);
          });
        }}
      >
        <option value="false">Pending</option>
        <option value="true">Approved</option>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
