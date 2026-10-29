"use client";

import { useCallback, useSyncExternalStore } from "react";
import { loadSummaryCollapsed, saveSummaryCollapsed, SUMMARY_COLLAPSED_KEY } from "@/lib/summaryCollapsed";

// Same pattern as useTheme: a tiny localStorage-backed external store whose
// server snapshot is "expanded", so the static export hydrates without a mismatch.

const listeners = new Set<() => void>();
let cache: boolean | null = null;

function getSnapshot(): boolean {
  cache ??= loadSummaryCollapsed();
  return cache;
}

function getServerSnapshot(): boolean {
  return false;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SUMMARY_COLLAPSED_KEY || event.key === null) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSummaryCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setCollapsed = useCallback((next: boolean) => {
    cache = next;
    saveSummaryCollapsed(next);
    notify();
  }, []);

  return [collapsed, setCollapsed] as const;
}

// Tests only: forget the cached value so the next read comes from storage.
export function resetSummaryCollapsedStore() {
  cache = null;
}
