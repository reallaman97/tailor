"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { runChecksAction } from "./actions";

type Bidder = { id: string; name: string };

export function ChecksControls({
  from,
  to,
  bidderId,
  bidders,
}: {
  from: string;
  to: string;
  bidderId: string;
  bidders: Bidder[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState(runChecksAction, undefined);

  function navigate(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    router.push(`/checks?${sp.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            defaultValue={from}
            max={to || undefined}
            onChange={(e) => navigate({ from: e.target.value })}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            defaultValue={to}
            min={from || undefined}
            onChange={(e) => navigate({ to: e.target.value })}
            className="h-9 w-[9.5rem]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Bidder</label>
          <Select
            value={bidderId}
            onChange={(e) => navigate({ bidder: e.target.value })}
            className="h-9 min-w-[12rem]"
            aria-label="Filter by bidder"
          >
            <option value="">All bidders</option>
            {bidders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        <form action={formAction} className="ml-auto">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="bidder" value={bidderId} />
          <Button type="submit" loading={pending}>
            {pending ? "Checking…" : "Run checks"}
          </Button>
        </form>
      </div>

      {state?.ok && <Alert variant="success">{state.ok}</Alert>}
      {state?.error && <Alert variant="destructive">{state.error}</Alert>}
    </div>
  );
}
