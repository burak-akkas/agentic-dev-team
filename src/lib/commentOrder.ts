export const COMMENT_ORDER_KEY = "kanban:comment-order";

export type CommentOrder = "oldest" | "newest";

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Stored as "newest" or "oldest"; anything else reads as oldest first.
export function loadCommentOrder(storage = defaultStorage()): CommentOrder {
  try {
    return storage?.getItem(COMMENT_ORDER_KEY) === "newest" ? "newest" : "oldest";
  } catch {
    return "oldest";
  }
}

export function saveCommentOrder(value: CommentOrder, storage = defaultStorage()): void {
  try {
    storage?.setItem(COMMENT_ORDER_KEY, value);
  } catch {
    // Storage may be full or blocked; the choice just won't persist.
  }
}
