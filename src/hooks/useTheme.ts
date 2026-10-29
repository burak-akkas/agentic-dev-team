"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { loadTheme, resolveTheme, saveTheme, THEME_KEY, type ThemePreference } from "@/lib/theme";

// Same pattern as useBoard: a tiny localStorage-backed external store whose
// server snapshot is "system", so the static export hydrates without a mismatch.

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();
let cache: ThemePreference | null = null;

function getSnapshot(): ThemePreference {
  cache ??= loadTheme();
  return cache;
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
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

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(preference, media.matches);
    };
    apply();
    if (preference !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    cache = next;
    saveTheme(next);
    notify();
  }, []);

  return [preference, setPreference] as const;
}

// Tests only: forget the cached preference so the next read comes from storage.
export function resetThemeStore() {
  cache = null;
}
