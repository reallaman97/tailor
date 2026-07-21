"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

/** Navigates to /dashboard?profile=<id> (or back to /dashboard for "All profiles") — every section of the page is scoped server-side by that query param. */
export function ProfileFilter({
  profiles,
  selectedProfileId,
}: {
  profiles: Array<{ id: string; fullName: string | null }>;
  selectedProfileId?: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedProfileId ?? ""}
      onChange={(e) => router.push(e.target.value ? `/dashboard?profile=${e.target.value}` : "/dashboard")}
      className="h-9 min-w-[16rem]"
      aria-label="Filter dashboard by profile"
    >
      <option value="">All profiles</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>
          {p.fullName ?? "Untitled profile"}
        </option>
      ))}
    </Select>
  );
}
