"use client";

import { SunIcon, MoonIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

function toggleTheme() {
  const root = document.documentElement;
  const isDark = !root.classList.contains("dark");
  root.classList.toggle("dark", isDark);
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {
    // Ignore — e.g. storage disabled/full. Toggling still works for this load.
  }
}

/**
 * Icon visibility is pure CSS (`dark:` variant), not React state — the
 * `.dark` class is already applied pre-hydration by the inline script in
 * layout.tsx, so there's no flash and no hydration-mismatch risk.
 */
export function ThemeToggle() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle light/dark theme"
    >
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="size-4 dark:hidden" />
    </Button>
  );
}
