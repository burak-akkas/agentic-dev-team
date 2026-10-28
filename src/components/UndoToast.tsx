"use client";

import { useEffect } from "react";

export const UNDO_TOAST_MS = 6000;

export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, UNDO_TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded px-2 py-1 font-semibold underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        Undo
      </button>
    </div>
  );
}
