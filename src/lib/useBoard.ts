"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyBoard, type Board } from "./board";
import { loadBoard, saveBoard, STORAGE_KEY } from "./storage";

// A tiny external store backed by localStorage. useSyncExternalStore renders the
// empty server snapshot during the static export, then switches to the stored
// board on the client without a hydration mismatch.

const SERVER_BOARD = emptyBoard();
const listeners = new Set<() => void>();
let cache: Board | null = null;

function getSnapshot(): Board {
  cache ??= loadBoard();
  return cache;
}

function getServerSnapshot(): Board {
  return SERVER_BOARD;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
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

export function useBoard() {
  const board = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((change: (board: Board) => Board) => {
    cache = change(getSnapshot());
    saveBoard(cache);
    notify();
  }, []);
  return [board, update] as const;
}

// Tests only: forget the cached board so the next read comes from storage.
export function resetBoardStore() {
  cache = null;
}
