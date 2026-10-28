"use client";

import { useEffect, useRef, type ReactNode, type SyntheticEvent } from "react";

export function Dialog({
  labelledBy,
  onRequestClose,
  children,
}: {
  /** id of the element that names the dialog. */
  labelledBy: string;
  /** Called on Escape and on a backdrop click. The dialog stays open until the parent unmounts it. */
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Escape: take over from the browser so the parent can decide whether to close.
    event.preventDefault();
    onRequestClose();
  }

  return (
    // A click whose target is the <dialog> itself can only land on the backdrop (padding lives on the content).
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={handleCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onRequestClose();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50 dark:border-field"
    >
      {children}
    </dialog>
  );
}
