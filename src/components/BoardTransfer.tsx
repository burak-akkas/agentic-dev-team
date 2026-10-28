"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { COLUMNS, type Board } from "@/lib/board";
import { exportFilename, parseBoard, serializeBoard } from "@/lib/storage";
import { useBoard } from "@/lib/useBoard";

const BUTTON =
  "rounded-lg border border-zinc-300 bg-white px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";

function countCards(board: Board): number {
  return COLUMNS.reduce((total, { id }) => total + board.columns[id].length, 0);
}

function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function BoardTransfer() {
  const [board, update] = useBoard();
  const [pending, setPending] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  function exportBoard() {
    const blob = new Blob([serializeBoard(board)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    let text: string;
    try {
      text = await readFile(file);
    } catch {
      text = "";
    }
    // Reset so picking the same file again still fires a change event.
    input.value = "";
    const result = parseBoard(text);
    if (result.ok) {
      setError(null);
      setPending(result.board);
      // Wait for the panel to render, then focus the safe choice.
      setTimeout(() => cancelButton.current?.focus(), 0);
    } else {
      setPending(null);
      setError(result.error);
    }
  }

  function closeConfirmation() {
    setPending(null);
    importButton.current?.focus();
  }

  function confirmReplace() {
    if (pending) {
      update(() => pending);
    }
    closeConfirmation();
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex gap-2">
        <button type="button" onClick={exportBoard} className={BUTTON}>
          Export
        </button>
        <button type="button" ref={importButton} onClick={() => fileInput.current?.click()} className={BUTTON}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          aria-label="Import board file"
          onChange={onFileChange}
          tabIndex={-1}
          className="sr-only"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="max-w-xs rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
      {pending && (
        <div
          role="alertdialog"
          aria-labelledby="import-confirm-text"
          className="max-w-xs rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          <p id="import-confirm-text">
            Replace the current board with the imported one ({countCards(pending)} {countCards(pending) === 1 ? "card" : "cards"})? This cannot be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={confirmReplace} className={BUTTON}>
              Replace
            </button>
            <button type="button" ref={cancelButton} onClick={closeConfirmation} className={BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
