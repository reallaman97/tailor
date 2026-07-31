"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function getListeners(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

export type PersistStorage = "local" | "session";

function getStore(storage: PersistStorage): Storage | null {
  try {
    return storage === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string, storage: PersistStorage): string | null {
  try {
    return getStore(storage)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string, storage: PersistStorage) {
  try {
    getStore(storage)?.setItem(key, raw);
  } catch {
    // ignore quota/unavailable storage
  }
  getListeners(key).forEach((notify) => notify());
}

function parseOr<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Like useState, but persisted to localStorage under `key` — so UI state
 * (table filters/column widths, form selections) survives navigating away
 * and back, since each page load is a fresh component instance.
 *
 * Reads via useSyncExternalStore, which is React's sanctioned way to handle
 * exactly this: `getServerSnapshot` reports `null` (localStorage doesn't
 * exist on the server) and React deliberately reuses that for the client's
 * *first* (hydration) render too, so it matches the server-rendered markup
 * exactly — no mismatch — then re-renders with the real client value
 * immediately after. A lazy useState initializer (an earlier version of this
 * hook) reads localStorage during the client's first render, which can
 * differ from the server's markup whenever something was already stored
 * (e.g. a previously resized table column) — that's a real hydration
 * mismatch, not just a cosmetic one, and Next surfaces it as a console error.
 *
 * The parsed value is memoized on the raw string (via a first-render-frozen
 * `stableInitial` fallback, so the memo key never includes a fresh literal
 * default) — parsing fresh on every render was a second, earlier bug: it
 * handed callers a brand-new object/array reference each time even when
 * nothing changed, which made TanStack Table's controlled state think it
 * had changed on every render and recompute continuously, freezing the page.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  options?: { storage?: PersistStorage }
) {
  const storage = options?.storage ?? "local";
  const [stableInitial] = useState(initial);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const set = getListeners(key);
      set.add(onStoreChange);
      return () => set.delete(onStoreChange);
    },
    [key]
  );

  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key, storage),
    () => null
  );

  const value = useMemo(() => parseOr(raw, stableInitial), [raw, stableInitial]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = parseOr(readRaw(key, storage), stableInitial);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      writeRaw(key, JSON.stringify(resolved), storage);
    },
    [key, stableInitial, storage]
  );

  return [value, setValue] as const;
}
