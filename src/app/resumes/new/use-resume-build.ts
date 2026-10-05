"use client";

import { useRef, useState } from "react";
import type { CreateApplicationResult } from "./shared";

export type BuildPhase = "idle" | "creating" | "building" | "stopping";

type BuildOutcome = { builtId?: string; error?: string; duplicateId?: string; stopped?: boolean };

/**
 * Runs a resume build in its two steps (see src/lib/resumes/build.ts): the
 * form's server action creates the application, then the build route
 * generates its resume. While building, `stop()` aborts the request — which
 * cancels the DeepSeek call on the server — and marks the application
 * Canceled, so it stays on record but frees the company for another try.
 */
export function useResumeBuild(create: (formData: FormData) => Promise<CreateApplicationResult>) {
  const [phase, setPhase] = useState<BuildPhase>("idle");
  const [outcome, setOutcome] = useState<BuildOutcome>({});
  const controllerRef = useRef<AbortController | null>(null);
  const buildingIdRef = useRef<string | null>(null);

  async function submit(formData: FormData) {
    if (phase !== "idle") return;
    setOutcome({});
    setPhase("creating");
    try {
      const created = await create(formData);
      if (!created.createdId) {
        setOutcome({ error: created.error ?? "Couldn't create the application.", duplicateId: created.duplicateId });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      buildingIdRef.current = created.createdId;
      setPhase("building");
      const res = await fetch(`/api/resumes/${encodeURIComponent(created.createdId)}/build`, {
        method: "POST",
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; stopped?: boolean; error?: string } | null;
      if (body?.ok) setOutcome({ builtId: created.createdId });
      else if (body?.stopped) setOutcome({ stopped: true });
      else setOutcome({ error: body?.error ?? "The build didn't finish — try again in a minute." });
    } catch (err) {
      if (controllerRef.current?.signal.aborted) setOutcome({ stopped: true });
      else setOutcome({ error: err instanceof Error && err.message ? err.message : "Couldn't reach the server — check your connection and try again." });
    } finally {
      controllerRef.current = null;
      buildingIdRef.current = null;
      setPhase("idle");
    }
  }

  async function stop() {
    const id = buildingIdRef.current;
    if (!id || phase !== "building") return;
    setPhase("stopping");
    // Mark it Canceled first, so the build's rollback keeps it on record
    // instead of deleting it; then cut the request (and the AI call) off.
    await fetch(`/api/resumes/${encodeURIComponent(id)}/cancel`, { method: "POST", keepalive: true }).catch(() => {});
    controllerRef.current?.abort();
  }

  return { phase, pending: phase !== "idle", outcome, submit, stop };
}
