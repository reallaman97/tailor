"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInboxEmailAction, findProfileApplicationsAction } from "../actions";
import { CATEGORY_LABEL, WORK_MODE_LABEL } from "@/lib/inbox/labels";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmailCategory, WorkMode } from "@/generated/prisma/client";

/**
 * Corrections when the automatic sorting got it wrong: what the email is, the
 * work mode, which application it belongs to — and marking it handled.
 */
export function EmailControls({
  emailId,
  profileId,
  category,
  workMode,
  status,
  application,
}: {
  emailId: string;
  profileId: string;
  category: EmailCategory;
  workMode: WorkMode;
  status: string;
  application: { id: string; companyName: string; jobTitle: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ id: string; companyName: string; jobTitle: string; date: string }[] | null>(null);

  function save(patch: Parameters<typeof updateInboxEmailAction>[1]) {
    startTransition(async () => {
      await updateInboxEmailAction(emailId, patch);
      router.refresh();
    });
  }

  function search() {
    if (query.trim().length < 2) return;
    startTransition(async () => setMatches(await findProfileApplicationsAction(profileId, query)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Type</span>
          <Select value={category} disabled={pending} onChange={(e) => save({ category: e.target.value as EmailCategory })}>
            {(Object.keys(CATEGORY_LABEL) as EmailCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Work mode</span>
          <Select value={workMode} disabled={pending} onChange={(e) => save({ workMode: e.target.value as WorkMode })}>
            {(Object.keys(WORK_MODE_LABEL) as WorkMode[]).map((m) => (
              <option key={m} value={m}>
                {WORK_MODE_LABEL[m]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-foreground">Application</span>
        {application ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/interview-tracker/${application.id}`} className="text-primary hover:underline">
              {application.companyName} — {application.jobTitle}
            </a>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" disabled={pending} onClick={() => save({ resumeId: null })}>
              Unlink
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">None linked.</span>
        )}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            placeholder="Find this profile's application — company or title"
            aria-label="Find application"
          />
          <Button variant="outline" onClick={search} disabled={pending}>
            Find
          </Button>
        </div>
        {matches && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {matches.length === 0 && <li className="px-3 py-2 text-muted-foreground">No matching application for this profile.</li>}
            {matches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {m.companyName} — {m.jobTitle}{" "}
                  <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => (save({ resumeId: m.id }), setMatches(null))}>
                  Link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => save({ status: "done" })}>
              Mark handled
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => save({ status: "dismissed" })}>
              Dismiss
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => save({ status: "open" })}>
            Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
