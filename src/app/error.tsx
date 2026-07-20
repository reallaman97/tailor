"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "@/components/icons";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircleIcon className="size-6" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Your data is safe — try again, or come back in a moment.
      </p>
      <Button onClick={() => unstable_retry()}>Try again</Button>
    </main>
  );
}
