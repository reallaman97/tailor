"use client";

import { useRef, useState } from "react";
import { checkDuplicateAction, type DuplicateCheckResult } from "./duplicate-actions";

type Duplicate = NonNullable<DuplicateCheckResult["duplicate"]>;

/**
 * Warns about a duplicate job as soon as the user leaves the company, link,
 * or description field — before Build is clicked, so no AI tokens are spent.
 * Re-checks only when those values actually changed. Wire `onBlur` to the
 * <form> (blur events bubble from its fields).
 */
export function useDuplicateCheck(profileId?: string) {
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const lastKey = useRef("");

  async function onBlur(e: React.FocusEvent<HTMLFormElement>) {
    const data = new FormData(e.currentTarget);
    const input = {
      companyName: String(data.get("companyName") ?? "").trim(),
      jobLink: String(data.get("jobLink") ?? "").trim(),
      jobDescription: String(data.get("jobDescription") ?? "").trim(),
      profileId: profileId || undefined,
    };
    if (!input.companyName && !input.jobLink && input.jobDescription.length < 100) return;
    const key = JSON.stringify(input);
    if (key === lastKey.current) return;
    lastKey.current = key;
    try {
      const result = await checkDuplicateAction(input);
      // Ignore a stale reply if the fields changed while it was in flight.
      if (lastKey.current === key) setDuplicate(result.duplicate ?? null);
    } catch {
      // Best-effort warning only — the server re-checks when building.
    }
  }

  return { duplicate, onBlur };
}
