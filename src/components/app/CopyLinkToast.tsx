"use client";

import { useEffect } from "react";
import { Toast } from "@/components/ui";

export const COPY_TOAST_MS = 3000;

// "copied" confirms a successful copy and disappears on its own. A link string means the clipboard
// was unavailable: show the link so it can be copied by hand.
export function CopyLinkToast({ result, onDismiss }: { result: "copied" | { url: string }; onDismiss: () => void }) {
  const copied = result === "copied";

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(onDismiss, COPY_TOAST_MS);
    return () => clearTimeout(timer);
  }, [copied, onDismiss]);

  if (copied) {
    return (
      <Toast>
        <span>Link copied</span>
      </Toast>
    );
  }

  return (
    <Toast>
      <span>Could not copy. Copy the link by hand:</span>
      <code className="max-w-[50vw] overflow-x-auto rounded bg-black/20 px-2 py-1 select-all dark:bg-white/20">
        {result.url}
      </code>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-2 py-1 font-semibold underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Dismiss
      </button>
    </Toast>
  );
}
