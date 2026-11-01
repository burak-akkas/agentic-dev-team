"use client";

import { useCallback, useSyncExternalStore } from "react";
import { COMMENT_ORDER_KEY, loadCommentOrder, saveCommentOrder, type CommentOrder } from "@/lib/commentOrder";

// Same pattern as useSummaryCollapsed: a tiny localStorage-backed external store
// whose server snapshot is "oldest", so the static export hydrates without a mismatch.

const listeners = new Set<() => void>();
let cache: CommentOrder | null = null;

function getSnapshot(): CommentOrder {
  cache ??= loadCommentOrder();
  return cache;
}

function getServerSnapshot(): CommentOrder {
  return "oldest";
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMMENT_ORDER_KEY || event.key === null) {
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

export function useCommentOrder() {
  const order = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOrder = useCallback((next: CommentOrder) => {
    cache = next;
    saveCommentOrder(next);
    notify();
  }, []);

  return [order, setOrder] as const;
}

// Tests only: forget the cached value so the next read comes from storage.
export function resetCommentOrderStore() {
  cache = null;
}
