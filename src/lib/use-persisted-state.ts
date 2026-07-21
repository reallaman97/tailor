"use client";

import { useCallback, useState } from "react";

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string) {
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // ignore quota/unavailable storage
  }
}

/**
 * Like useState, but persisted to localStorage under `key` — so UI state
 * (table filters/column widths, form selections) survives navigating away
 * and back, since each page load is a fresh component instance.
 *
 * The stored value is read once, in useState's lazy initializer (runs
 * synchronously during the first render — not in an effect, so there's no
 * cascading-render lint violation, and not from a ref, which this project's
 * lint forbids reading during render). From then on it's plain React state:
 * updated only by calling the returned setter, never re-parsed from
 * localStorage on every render. An earlier version re-ran JSON.parse on
 * every render whenever anything was already stored, handing a brand-new
 * object/array reference to callers each time — TanStack Table's controlled
 * `state` read that as "state changed" on every render and recomputed
 * continuously, freezing the page. Plain useState can't do that: its
 * returned value only changes when the setter is actually called.
 *
 * Server-rendered markup can't read localStorage, so the server and the
 * client's first render both use `initial` — the restored value (if any)
 * applies from the very first client render's lazy initializer, which for a
 * client component runs before paint, so there's nothing to flicker.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    const raw = readRaw(key);
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const persist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        writeRaw(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key]
  );

  return [value, persist] as const;
}
