"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Resume requests get their Word resume prepared without anyone asking: while
 * this page is open, pending ones are built one at a time (each is a normal
 * 1–2 minute tailoring run), and the list refreshes as each is ready.
 */
export function AutoPrepare({ emailIds }: { emailIds: string[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<number | null>(null);
  const started = useRef(new Set<string>());

  useEffect(() => {
    const queue = emailIds.filter((id) => !started.current.has(id));
    if (queue.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < queue.length && !cancelled; i++) {
        started.current.add(queue[i]);
        setCurrent(i + 1);
        await fetch(`/api/inbox/emails/${encodeURIComponent(queue[i])}/prepare`, { method: "POST" }).catch(() => {});
        router.refresh();
      }
      setCurrent(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [emailIds, router]);

  if (current === null) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Preparing tailored Word resume{emailIds.length > 1 ? `s (${current} of ${emailIds.length})` : ""} for resume requests — keep this page open…
    </p>
  );
}
