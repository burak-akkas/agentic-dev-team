"use client";

import { useEffect } from "react";
import { Toast } from "./ui";

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
    <Toast>
      <span>{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded px-2 py-1 font-semibold underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Undo
      </button>
    </Toast>
  );
}
