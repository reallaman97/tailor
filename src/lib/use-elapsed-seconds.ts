"use client";

import { useEffect, useState } from "react";

/**
 * Whole seconds since the calling component mounted, ticking once a second.
 * Mount the component only while the thing being timed is in progress, so each
 * run starts again from zero.
 */
export function useElapsedSeconds(): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return Math.floor((now - start) / 1000);
}
