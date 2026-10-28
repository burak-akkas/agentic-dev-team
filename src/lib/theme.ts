export const THEME_KEY = "kanban-theme-v1";

export type ThemePreference = "system" | "light" | "dark";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadTheme(storage = defaultStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isThemePreference(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function saveTheme(preference: ThemePreference, storage = defaultStorage()): void {
  try {
    storage?.setItem(THEME_KEY, preference);
  } catch {
    // Storage may be full or blocked; the choice just won't persist.
  }
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}
