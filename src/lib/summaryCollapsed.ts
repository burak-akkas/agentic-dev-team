export const SUMMARY_COLLAPSED_KEY = "kanban:summary-collapsed";

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Stored as "1" (collapsed) or "0"; anything else reads as expanded.
export function loadSummaryCollapsed(storage = defaultStorage()): boolean {
  try {
    return storage?.getItem(SUMMARY_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSummaryCollapsed(value: boolean, storage = defaultStorage()): void {
  try {
    storage?.setItem(SUMMARY_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // Storage may be full or blocked; the choice just won't persist.
  }
}
