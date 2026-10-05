"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";

/**
 * "Cancel application" — the candidate decided not to apply (e.g. spotted a
 * deal-breaker while filling in the form). The application is kept, marked
 * Canceled, and no longer blocks another application to the same company.
 */
export function CancelApplicationButton({ resumeId, companyName }: { resumeId: string; companyName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${encodeURIComponent(resumeId)}/cancel`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(body?.error ?? "Couldn't cancel the application — try again.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        triggerContent="Cancel application"
        triggerVariant="ghost"
        triggerClassName="text-destructive hover:bg-destructive/10 hover:text-destructive"
        title="Cancel this application?"
        description={`Use this if you decided not to apply to ${companyName}. It stays in the tracker marked Canceled, and you can build a new application for this company later.`}
        confirmLabel="Cancel application"
        dismissLabel="Keep it"
        action={cancel}
      />
      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  );
}
