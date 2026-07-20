type ClassValue = string | number | null | undefined | false | Record<string, boolean | undefined>;

/**
 * Minimal clsx-style class joiner. No tailwind-merge conflict resolution —
 * we avoid stacking conflicting utilities (e.g. two different `px-*`) at
 * the call site instead of depending on a runtime merge package.
 */
export function cn(...values: ClassValue[]): string {
  const classes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
    } else {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}
