"use client";

import { useEffect } from "react";

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
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-gray-600">
        An unexpected error occurred. Your data is safe — try again, or come back in a moment.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="rounded bg-black px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </main>
  );
}
